import "./init";
import * as prometheus from "prom-client";
import EventSource from "eventsource";
import express from "express";
import { db } from "./db";
import { networkEventHistoryTable, networkStatsAggregatedTable, networkStatsTable, networkTable } from "./schema";
import { eq, ne, sql } from "drizzle-orm";
import { ownerSignature, ownerKey, setOwner } from "./variables";
import { fetchAndSaveNetworkData, fetchNetworkData, getNetworkData, keyedThrottle, requestRestartSpectodaNodeService, saveNetworkDataLocally, sendNotificationRequestToCloud } from "./utils";
import { getEstimatedWatt } from "./wattage";
import { fetchAndSetEvents, fetchAndSetPeers, isDeviceActive } from "./handle-offline";
const debug = require("debug")("main");

export const BASE_URL = "http://localhost:8888";

export let peers = new Set<string>();

// TODO check performance, if slow switch to using subscription per "event" basis or throtthling
const evs = new EventSource(`${BASE_URL}/events`);

require("isomorphic-fetch");

evs.onopen = () => {
  console.log("Connected to spectoda-node");
};

const evsConnection = new EventSource(`${BASE_URL}/connection`);

evsConnection.onmessage = async event => {
  peers = new Set<string>();

  try {
    if (event.data === "connected") {
      await loadCredentials();
    }
  } finally {
    sendNotificationRequestToCloud(`SpectodaNode ${event.data}`).catch(console.error);
  }
};

export async function loadCredentials() {
  try {
    console.log("Loading credentials");
    const credentials = await getKeyAndSignature();
    await fetchAndSetPeers();
    // TODO reenable when ready
    // await fetchAndSetEvents();
    const network = await db.select().from(networkTable).where(eq(networkTable.ownerSignature, credentials.ownerSignature)).get();

    if (network) {
      await db
        .update(networkTable)
        .set({
          network: credentials.network,
          ownerKey: credentials.ownerKey,
          ownerSignature: credentials.ownerSignature,
        })
        .where(eq(networkTable.ownerSignature, credentials.ownerSignature))
        .run();

      debug("Keeping old signature and key");
    } else {
      await db.insert(networkTable).values({
        network: credentials.network,
        ownerKey: credentials.ownerKey,
        ownerSignature: credentials.ownerSignature,
      });
      debug("Network Signature and key saved %O", credentials);
    }

    await fetchAndSaveNetworkData(credentials);
  } catch (error) {
    console.error("Error while loading credentials", error);
  }
}

loadCredentials();

async function getKeyAndSignature() {
  const { ownerKey, ownerSignature, network } = await fetch(`${BASE_URL}/owner`).then(v => v.json());
  debug("got credentials %O", { ownerKey, ownerSignature, network });

  setOwner({
    network,
    ownerKey,
    ownerSignature,
  });

  return { ownerKey, ownerSignature, network };
}

evs.onmessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    debug("received event %o", data);

    // TODO validate received data

    // Update the metrics using the received data
    let { id, label, value, type, timestamp } = data;

    if (type === "color") {
      value = parseInt(value.substring(1), 16);
    }

    if (type === "label") {
      // just dont save it if it is a label event
      return;
    }

    // Update the gauge metric with the value based on the id and label
    // eventValue.labels(id.toString(), label).set(value);

    keyedThrottle(
      `
    ${id}_${label}
  `,
      () => {
        db.insert(networkEventHistoryTable)
          .values({
            segId: id,
            network_timestamp: timestamp,
            label: label,
            timestamp_utc: new Date(),
            type: type,
            ownerSignature: ownerSignature,
            value: value,
          })
          .run();
      },
      5000,
    );
  } catch (error) {
    console.error("Error while processing event", error);
  }
};

// Create a new Prometheus Registry
const register = new prometheus.Registry();

// Define a Gauge metric to track the values of events by id and label
// const eventValue = new prometheus.Gauge({
//   name: "event_value",
//   help: "Value of events",
//   labelNames: ["id", "label"],
//   registers: [register],
// });

// Register the metric with the Prometheus client
// register.registerMetric(eventValue);

const app = express();
app.get("/metrics", async (req, res) => {
  debug("Metrics called");
  try {
    const metrics = await register.metrics();
    res.set("Content-Type", register.contentType);
    res.send(metrics);
  } catch (ex) {
    res.status(500).send(ex.message);
  }
});

async function aggregateNetworkStats() {
  try {
    // select all network stats that are not yet aggregated
    const aggregatedNetworkStats = await db
      .select({
        count: sql<number>`count(${networkStatsTable.id})`,
        segId: networkStatsTable.segId,
        watt: sql<number>`avg(${networkStatsTable.watt})`,
        timestamp_utc: sql<number>`max(${networkStatsTable.timestamp_utc})`,
        brightness: sql<number>`avg(${networkStatsTable.brightness})`,
      })
      .from(networkStatsTable)
      .groupBy(({ segId }) => segId)
      .all();

    if (aggregatedNetworkStats.length >= 1) {
      await db
        .insert(networkStatsAggregatedTable)
        .values(
          aggregatedNetworkStats.map(v => ({
            brightness: v.brightness,
            segId: v.segId,
            timestamp_utc: new Date(v.timestamp_utc * 1000),
            watt: v.watt,
          })),
        )
        .run();
      await db.delete(networkStatsTable).run();
    }
  } catch (error) {
    console.error("Error while adding calculated network stats", error);
  }
}

async function addCurrentNetworkStats() {
  // get devices from firebase
  // this function will run every 15 seconds and scrape latest variable data /fetchVariableValue and save it to db
  // every 5 minutes addCalculatedNetworkStats will run and calculate the average brightness and wattage for each device and save it to db

  try {
    let data = [];

    const network = await getNetworkData();

    if (network) {
      const devices = network.devices;
      // use fetchVariables and calculate powerconsumtion into data array

      const variables = devices.map(device => ({ name: "lightlevel", segId: device.id }));

      const variablesValues = await fetchVariablesValues(variables);
      await fetchAndSetPeers();

      // TODO remove this temporary hack
      const invalidData = variablesValues?.data?.any(({ value }, index) => {
        // if (value?.debug === "undefined") {
        //   const msg = "undefined value received from spectoda-node";
        //   // requestRestartSpectodaNodeService(msg);
        //   sendNotificationRequestToCloud(msg);
        //   return true;
        // }
      });

      if (!invalidData) {
        data = variablesValues?.data.map(({ segId, value }, index) => {
          const device = devices[index];

          // check if device is active
          if (isDeviceActive(device, network)) {
            const watt = getEstimatedWatt(value?.value, network.devices[index].powerConsumption);
            debug("device %o", { value, watt });

            return {
              segId,
              timestamp_utc: new Date(),
              brightness: value?.value,
              watt,
            };
          } else {
            debug("device %o", { value });

            return {
              segId,
              timestamp_utc: new Date(),
              brightness: 0,
              watt: 0,
            };
          }
        });

        // insert into db
        if (data.length >= 1) {
          db.insert(networkStatsTable).values(data).run();
        }
      }
    }
  } catch (error) {
    console.trace("Error while adding current network stats", error);
  }
}

setInterval(
  () => {
    aggregateNetworkStats();
  },
  // @ts-ignore
  process.env.STATS_INTERVAL || 100000,
);

setInterval(
  () => {
    addCurrentNetworkStats();
  },
  // @ts-ignore
  process.env.STATS_SCRAPE_INTERVAL || 15 * 1000,
);

// app.listen(8080, () => {
//   console.log("Metrics server listening on port 8080");
// });

function fetchVariableValue(name: string, segId: number) {
  return fetch(`http://localhost:8888/variable?name=${name}&seg_id=${segId}`)
    .then(response => response.json())
    .then(data => data?.value);
}

function fetchVariablesValues(payload: { name: string; segId: number }[]) {
  return fetch(`http://localhost:8888/variables`, {
    body: JSON.stringify({ variables: payload }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(response => response.json())
    .then(data => data);
}

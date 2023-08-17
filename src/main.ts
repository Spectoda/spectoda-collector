import "./init";
import * as prometheus from "prom-client";
import EventSource from "eventsource";
import express from "express";
import { db } from "./db";
import { networkEventHistoryTable, networkStatsTable, networkTable } from "./schema";
import { eq, ne } from "drizzle-orm";
import { ownerSignature, ownerKey, setOwner } from "./variables";
import { fetchAndSaveNetworkData, fetchNetworkData, getNetworkData, keyedThrottle, saveNetworkDataLocally } from "./utils";
import { getEstimatedWatt } from "./wattage";

const BASE_URL = "http://localhost:8888";

// TODO check performance, if slow switch to using subscription per "event" basis or throtthling
const evs = new EventSource(`${BASE_URL}/events`);

require("isomorphic-fetch");

evs.onopen = () => {
  console.log("Connected to spectoda");
};

const evsConnection = new EventSource(`${BASE_URL}/connection`);

evsConnection.onmessage = event => {
  loadCredentials();
};

export async function loadCredentials() {
  try {
    const credentials = await getKeyAndSignature();
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

      console.log("Keeping old signature and key");
    } else {
      await db.insert(networkTable).values({
        network: credentials.network,
        ownerKey: credentials.ownerKey,
        ownerSignature: credentials.ownerSignature,
      });
      console.log("Signature and key saved", credentials);
    }

    await fetchAndSaveNetworkData(credentials);
  } catch (error) {
    console.log("Error while loading credentials", error);
  }
}

loadCredentials();

async function getKeyAndSignature() {
  const { ownerKey, ownerSignature, network } = await fetch(`${BASE_URL}/owner`).then(v => v.json());
  console.log({ ownerKey, ownerSignature, network });

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
    console.log(data);

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
    eventValue.labels(id.toString(), label).set(value);

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
    console.log("Error while processing event", error);
  }
};

// Create a new Prometheus Registry
const register = new prometheus.Registry();

// Define a Gauge metric to track the values of events by id and label
const eventValue = new prometheus.Gauge({
  name: "event_value",
  help: "Value of events",
  labelNames: ["id", "label"],
  registers: [register],
});

// Register the metric with the Prometheus client
register.registerMetric(eventValue);

const app = express();
app.get("/metrics", async (req, res) => {
  console.log("Metrics called");
  try {
    const metrics = await register.metrics();
    res.set("Content-Type", register.contentType);
    res.send(metrics);
  } catch (ex) {
    res.status(500).send(ex.message);
  }
});

async function addCurrentNetworkStats() {
  // get devices from firebase

  try {
    let data = [];

    const network = await getNetworkData();

    if (network) {
      const devices = network.devices;
      console.log("Calculating power consumption from these devices", { devices });

      const fetchData = async device => {
        const brightness = process.env.FAKE_DATA == "true" ? Math.random() * 100 : await fetchVariableValue("lightlevel", device.id);

        const watt = device?.powerConsumption ? getEstimatedWatt(brightness, device?.powerConsumption) : null;

        return {
          segId: device.id,
          timestamp_utc: new Date(),
          brightness,
          watt,
        };
      };

      data = await Promise.all(devices.map(fetchData));
    }

    // insert into db
    if (data.length >= 1) {
      db.insert(networkStatsTable).values(data).run();
    }
  } catch (error) {
    console.error("Error while adding current network stats", error);
  }
}

setInterval(
  () => {
    addCurrentNetworkStats();
  },
  // @ts-ignore
  process.env.STATS_INTERVAL || 5 * 60 * 1000,
);

app.listen(8080, () => {
  console.log("Metrics server listening on port 8080");
});

function fetchVariableValue(name: string, segId: number) {
  return fetch(`http://localhost:8888/variable?name=${name}&seg_id=${segId}`)
    .then(response => response.json())
    .then(data => data?.value?.value);
}

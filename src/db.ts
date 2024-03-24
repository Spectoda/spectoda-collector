// import { migrate } from "drizzle-orm/sqlite-core/migrator";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import Database from "better-sqlite3";
import { networkEventHistoryTable, networkStatsAggregatedTable, networkStatsTable } from "./schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { inArray } from "drizzle-orm";
import { ownerKey, ownerSignature } from "./variables";

const debug = require("debug")("events");

require("isomorphic-fetch");

export const BASE_API_URL = "https://cloud.host.spectoda.com"; //"http://localhost:4000"; //

const sqlite = new Database("sqlite.db");
export const db = drizzle(sqlite, { logger: false });

// TODO read this from SpectodaNODE

// this will automatically run needed migrations on the database
async function sync() {
  syncEventHistory();
  syncStats();
}

async function syncEventHistory() {
  const eventHistory = await db.select().from(networkEventHistoryTable).limit(100).all();
  if (eventHistory.length > 0) {
    const eventHistoryIds = eventHistory.map(v => v.id);
    try {
      await postDataToCloud(eventHistory);
      await db.delete(networkEventHistoryTable).where(inArray(networkEventHistoryTable.id, eventHistoryIds)).run();
      debug("Sent events to cloud and deleted from local db");
    } catch (err) {
      console.error(err);
    }
  }
}

async function syncStats() {
  const stats = await db.select().from(networkStatsAggregatedTable).limit(100).all();
  if (stats.length > 0) {
    const statsIds = stats.map(v => v.id);
    try {
      await postStatsToCloud(stats);
      await db.delete(networkStatsAggregatedTable).where(inArray(networkStatsAggregatedTable.id, statsIds)).run();
    } catch (err) {
      console.error(err);
    }
  }
}

// function insertDemoValue() {
//   return db
//     .insert(eventHistoryTable)
//     .values({
//       identifier: Math.floor(Math.random() * 255),
//       label: "test",
//       timestamp: new Date(),
//       timestamp_utc: new Date(),
//       type: "test",
//       value: Math.random() * 200 - 100,
//       ownerSignature: ownerSignature,
//     })
//     .run();
// }

function postDataToCloud(data: any) {
  debug("sending Events Cloud %o", data);
  return fetch(`${BASE_API_URL}/api/network-events`, {
    method: "post",
    body: JSON.stringify({
      events: data,
      ownerKey: ownerKey,
      ownerSignature: ownerSignature,
    }),
    headers: {
      "Content-Type": "application/json",
      "owner-key": ownerKey,
      "owner-signature": ownerSignature,
    },
  });
}

function postStatsToCloud(data: any) {
  debug("sending stats Cloud", data);
  return fetch(`${BASE_API_URL}/api/stats`, {
    method: "post",
    body: JSON.stringify({
      stats: data,
      ownerKey: ownerKey,
      ownerSignature: ownerSignature,
    }),
    headers: {
      "Content-Type": "application/json",
      "owner-key": ownerKey,
      "owner-signature": ownerSignature,
    },
  });
}

async function main() {
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  sync();

  // @ts-ignore
  setInterval(() => sync(), process.SYNCHRONIZE_CLOUD_INTERVAL || 1000 * 15);
}

main();

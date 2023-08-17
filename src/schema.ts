import { integer, sqliteTable, numeric, real, index, text } from "drizzle-orm/sqlite-core";

// export const eventHistoryTable = sqliteTable("event_history", {
//   id: integer("id").primaryKey({ autoIncrement: true }),
//   identifier: integer("identifier"),
//   label: text("label"), // todo limit to 5
//   timestamp: integer("timestamp", { mode: "timestamp_ms" }),
//   timestamp_utc: integer("timestamp_utc", { mode: "timestamp" }), // Consider if this value can be stored as integer.
//   type: text("type", { length: 10 }), // todo define all types
//   value: real("value"), // todo define all formats
//   ownerSignature: text("ownerSignature"), // todo define the specific legth
// });

export const networkEventHistoryTable = sqliteTable("network_event_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  networkId: integer("networkId"),
  label: text("label"), // todo limit to 5
  segId: integer("segId"),
  network_timestamp: integer("network_timestamp"),
  timestamp_utc: integer("timestamp_utc", { mode: "timestamp" }), // Consider if this value can be stored as integer.
  type: integer("type"), // todo define all types
  value: real("value"), // todo define all formats

  ownerSignature: text("ownerSignature"), // todo define the specific legth
});

export const networkTable = sqliteTable("network", {
  network: text("network"),
  ownerSignature: text("ownerSignature"),
  ownerKey: text("ownerKey"),
});

export const networkStatsTable = sqliteTable("network_stats", {
  // only for simplified storage
  id: integer("id").primaryKey({ autoIncrement: true }),

  networkId: integer("networkId"),
  segId: integer("segId"),
  timestamp_utc: integer("timestamp_utc", { mode: "timestamp" }),
  watt: real("watt"),
  brightness: real("brightness"),

  ownerSignature: text("ownerSignature"),
});

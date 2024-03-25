import fs from "fs";
import { db } from "./db";
import { networkEventHistoryTable, networkStatsAggregatedTable } from "./schema";

async function clear() {
  await db.delete(networkEventHistoryTable).run();
  await db.delete(networkStatsAggregatedTable).run();

  // delete file networkdata.json
  fs.unlinkSync("./networkdata.json");
  console.log("Cleared all data");
}

clear();

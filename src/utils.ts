import { BASE_API_URL } from "./db";
import fs from "fs";
import { RootNetwork } from "./types";
import { network, ownerKey, ownerSignature } from "./variables";
import { loadCredentials } from "./main";

const throttleStore = new Map();

// @ts-ignore
if (!Array.prototype.any) {
  // @ts-ignore
  Array.prototype.any = function (callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }

    for (let i = 0; i < this.length; i++) {
      if (callback(this[i], i, this)) {
        return true;
      }
    }

    return false;
  };
}

export const keyedThrottle = (key, fn, delay) => {
  if (throttleStore.has(key)) {
    const lastExecution = throttleStore.get(key);
    const currentTimestamp = Date.now();

    // If the difference between current time and last execution time is less than delay, do not execute
    if (currentTimestamp - lastExecution.timestamp < delay) {
      // Update the last function and its execution time
      throttleStore.set(key, { fn, timestamp: lastExecution.timestamp });

      // Clear previous timeout if exists
      if (lastExecution.timeoutId) {
        clearTimeout(lastExecution.timeoutId);
      }

      // Set a timeout to call the last function after the delay
      const timeoutId = setTimeout(() => {
        fn();
      }, delay);

      // Save timeoutId to clear it next time
      throttleStore.set(key, { fn, timestamp: lastExecution.timestamp, timeoutId });
      return;
    }
  }

  // Call the function
  fn();

  // Update the last execution time
  throttleStore.set(key, { fn, timestamp: Date.now() });
};

// write fetch function
export function fetchNetworkData(network, key) {
  return fetch(`${BASE_API_URL}/networkdata`, {
    method: "POST",
    body: JSON.stringify({
      network,
      key,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  }).then(v => v.json());
}

export function saveNetworkDataLocally(networkData) {
  fs.writeFileSync("./networkdata.json", JSON.stringify(networkData, null, 2));
}

export async function getNetworkData() {
  if (!fs.existsSync("./networkdata.json")) {
    await loadCredentials();
  }

  if (fs.existsSync("./networkdata.json")) {
    let data = JSON.parse(fs.readFileSync("./networkdata.json").toString()) as RootNetwork;

    data.devices = data.devices.filter(v => v); // data?.devices ? new Map(Object.entries(data.devices.filter(v => v))) : new Map();
    // data.controllers = data?.controllers ? new Map(Object.entries(data.controllers)) : new Map();
    // data.groups = data?.groups ? new Map(Object.entries(data.groups) ?? undefined) : new Map();

    return data;
  }
}

export async function fetchAndSaveNetworkData(credentials: any) {
  try {
    const data = await fetchNetworkData(credentials.network, credentials.ownerKey);
    saveNetworkDataLocally(data);
  } catch (e) {
    console.error(e);
  }
}

export function requestRestartSpectodaNodeService(reason: string) {
  return fetch(`http://localhost:8888/restart?reason=${reason}`, {
    method: "GET",
  });
}

export function sendNotificationRequestToCloud(msg: string) {
  return fetch(`${BASE_API_URL}/api/notifications`, {
    method: "post",
    body: JSON.stringify({
      ownerKey: ownerKey,
      ownerSignature: ownerSignature,

      msg: msg,
      type: "warn",
      createdAt: new Date(),
    }),
    headers: {
      "Content-Type": "application/json",
      "owner-key": ownerKey,
      "owner-signature": ownerSignature,
    },
  });
}

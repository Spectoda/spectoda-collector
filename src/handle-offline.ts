import EventSource from "eventsource";
import { BASE_URL, loadCredentials, peers } from "./main";
import { getNetworkData } from "./utils";
const debug = require("debug")("peers");

const evsPeers = new EventSource(`${BASE_URL}/peers`);

evsPeers.onmessage = (event: any) => {
  try {
    const data = JSON.parse(event);
    if (data.type === "peer_connected") {
      peers.add(data.mac);
      console.log("peer_connect", data, { peers });
    } else if (data.type === "peer_disconnected") {
      peers.delete(data.mac);
      console.log("peer_disconnect", data, { peers });
    }
  } catch (error) {
    console.log("Error while handling peers", error);
  }
};

export async function fetchAndSetPeers() {
  try {
    const response = await fetch(`${BASE_URL}/peers-info`).then(v => v.json());
    const incomingPeers = response.data;

    incomingPeers.forEach((peer: { mac: string }) => {
      peers.add(peer?.mac);
    });
    debug({ peers });
  } catch (error) {
    console.log("Error while fetching peers", error);
  }
}

// Aug 25 11:40:36 spectoda bash[5361]: > Devices Scanned: [
//   Aug 25 11:40:36 spectoda bash[5361]:   '08:B6:1F:EE:B7:BA',
//   Aug 25 11:40:36 spectoda bash[5361]:   '08:B6:1F:EE:B8:0E',
//   Aug 25 11:40:36 spectoda bash[5361]:   '15:3C:FF:5D:C9:21',
//   Aug 25 11:40:36 spectoda bash[5361]:   '44:FE:A6:B0:6A:06',
//   Aug 25 11:40:36 spectoda bash[5361]:   '6C:3F:09:EB:C4:B4',
//   Aug 25 11:40:36 spectoda bash[5361]:   'EF:88:F7:DD:59:04'
//   Aug 25 11:40:36 spectoda bash[5361]: ]

export function isDeviceActive(device: any, networkData: any) {
  const uuids = device.controllerUuids;

  if (!uuids) {
    debug("Device not configured", device.id, device.name);
    return true;
  }

  for (const uuid of uuids) {
    const controller = networkData?.controllers?.[uuid];
    if (peers.has(controller.mac)) {
      debug("Device is ON", device.id, device.name);

      return true;
    } else {
      debug("Device is Offline", device.id, device.name);
    }
  }
}
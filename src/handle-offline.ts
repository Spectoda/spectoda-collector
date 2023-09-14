import EventSource from "eventsource";
import { BASE_URL, loadCredentials, peers } from "./main";
import { getNetworkData } from "./utils";
const debug = require("debug")("peers");

// const evsPeers = new EventSource(`${BASE_URL}/peers`);

// evsPeers.onmessage = (event: any) => {
//   try {
//     const data = JSON.parse(event);
//     if (data.type === "peer_connected") {
//       peers.add(data.mac);
//       debug("peer_connect %o", data);
//     } else if (data.type === "peer_disconnected") {
//       peers.delete(data.mac);
//       debug("peer_disconnect %o", data);
//     }
//   } catch (error) {
//     console.error("Error while handling peers", error);
//   }
// };

export async function fetchAndSetPeers() {
  try {
    const response = await fetch(`${BASE_URL}/peers-info`).then(v => v.json());
    const incomingPeers = response.data;
    peers.clear();

    incomingPeers?.forEach((peer: { mac: string }) => {
      peers.add(peer?.mac);
    });
    // debug({ peers });
  } catch (error) {
    console.error("Error while fetching peers", error);
  }
}

export async function fetchAndSetEvents() {
  try {
    const response = await fetch(`${BASE_URL}/events-info`).then(v => v.json());
    const incomingEvents = response?.data;

    debug("TODO incomingEvents %o", incomingEvents);
  } catch (error) {
    console.error("Error while fetching events", error);
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
    if (peers.has(controller?.mac)) {
      debug("Device is ON", device.id, device.name);

      return true;
    } else {
      debug("Device is Offline", device.id, device.name);
    }
  }
}

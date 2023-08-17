export let ownerSignature = "a06cd5c4d5741b61fee69422f2590926";
export let ownerKey = "427232275ad8452d7f97b03e0f71bef4___";
export let network = "427232275ad8452d7f97b03e0f71bef4___";

export function setOwner({ ownerSignature: key, ownerKey: signature, network: network_name }) {
  ownerKey = key;
  ownerSignature = signature;
  network = network_name;
}

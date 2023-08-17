export interface RootNetwork {
  controllers: Controllers;
  devices: Device[];
  groups: Groups;
  name: string;
  ownerKey: string;
  ownerSignature: string;
}

export interface Controllers {
  [key]: Controller;
}

export interface Controller {
  name: string;
  uuid: string;
}

export interface Device {
  controls: string;
  id: number;
  name: string;
  powerConsumption: PowerConsumption[];
}

export interface PowerConsumption {
  brightness: number;
  watt: number;
}

export interface Groups {
  [key]: Group;
}

export interface Group {
  deviceIds: number[];
  name: string;
  uuid: string;
}

import { PM5_REQUEST, PM5_UUID } from "../pm5/pm5";
import { LISTEN, type ErgLink, type Found, type Handlers } from "./link";

/* BLUETOOTH IN A BROWSER (Chrome, Edge, Android Chrome): Web Bluetooth. The
 * browser shows its own chooser, so there is no scan list. On a phone this
 * file is replaced by ble.native.ts. */

/* eslint-disable @typescript-eslint/no-explicit-any */
const bt = (): any => (typeof navigator !== "undefined" ? (navigator as any).bluetooth : undefined);

export const hasScanList = false;
export const available = (): boolean => !!bt();

export async function scan(_onFound: (d: Found) => void): Promise<() => void> {
  return () => {};
}

export async function connect(_id: string | null, h: Handlers): Promise<ErgLink> {
  const device = await bt().requestDevice(PM5_REQUEST);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService(PM5_UUID.rowingService);
  for (const uuid of LISTEN) {
    try {
      const ch = await svc.getCharacteristic(uuid);
      ch.addEventListener("characteristicvaluechanged", (e: any) => h.onPacket({ uuid, dv: e.target.value as DataView }));
      await ch.startNotifications();
    } catch {
      /* An older monitor has no force curve; the rest still streams. */
    }
  }
  device.addEventListener("gattserverdisconnected", () => h.onDrop("The monitor disconnected."));
  return { name: device.name ?? "PM5", stop: () => device.gatt?.disconnect() };
}

import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, State, type Subscription } from "react-native-ble-plx";
import { PM5_UUID, SAMPLE_RATE } from "../pm5/pm5";
import { LISTEN, type ErgLink, type Found, type Handlers } from "./link";

/* BLUETOOTH ON A PHONE: react-native-ble-plx, which is CoreBluetooth on iOS
 * and the Android BLE stack. Needs a development or store build: Expo Go
 * does not carry the native module. */

let manager: BleManager | null = null;
const mgr = (): BleManager => (manager ??= new BleManager());

export const hasScanList = true;
export const available = (): boolean => true;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function fromBase64(s: string): DataView {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[n++] = (a << 2) | (b >> 4);
    if (c >= 0) out[n++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[n++] = ((c & 3) << 6) | d;
  }
  return new DataView(out.buffer, 0, n);
}

function toBase64(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    s += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? "=" : B64[c & 63]);
  }
  return s;
}

async function permit(): Promise<void> {
  if (Platform.OS !== "android") return;
  const P = PermissionsAndroid.PERMISSIONS;
  const wanted = Number(Platform.Version) >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  const got = await PermissionsAndroid.requestMultiple(wanted);
  if (wanted.some((w) => got[w] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error("Bluetooth permission was not given.");
}

/* Resolves once the radio is on; rejects with a line to show when it is off or refused. */
function poweredOn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sub = mgr().onStateChange((s) => {
      if (s === State.PoweredOn) {
        sub.remove();
        resolve();
      } else if (s === State.PoweredOff) {
        sub.remove();
        reject(new Error("Bluetooth is off. Turn it on and try again."));
      } else if (s === State.Unauthorized) {
        sub.remove();
        reject(new Error("Bluetooth is not allowed for this app. Allow it in Settings."));
      } else if (s === State.Unsupported) {
        sub.remove();
        reject(new Error("This device has no Bluetooth the app can use."));
      }
    }, true);
  });
}

/* Every PM5 in range that is on its CONNECT screen. Returns the stop. */
export async function scan(onFound: (d: Found) => void): Promise<() => void> {
  await permit();
  await poweredOn();
  mgr().startDeviceScan([PM5_UUID.discovery], null, (err, device) => {
    if (err || !device) return;
    onFound({ id: device.id, name: device.name ?? device.localName ?? "PM5" });
  });
  return () => void mgr().stopDeviceScan();
}

export async function connect(id: string | null, h: Handlers): Promise<ErgLink> {
  if (!id) throw new Error("Pick a monitor first.");
  await mgr().stopDeviceScan();
  const device = await (await mgr().connectToDevice(id, { timeout: 12000 })).discoverAllServicesAndCharacteristics();
  const subs: Subscription[] = LISTEN.map((uuid) =>
    device.monitorCharacteristicForService(PM5_UUID.rowingService, uuid, (err, ch) => {
      if (!err && ch?.value) h.onPacket({ uuid, dv: fromBase64(ch.value) });
    }),
  );
  /* Four status packets a second instead of two; a monitor that refuses keeps its default. */
  device.writeCharacteristicWithResponseForService(PM5_UUID.rowingService, PM5_UUID.sampleRate, toBase64([SAMPLE_RATE.ms250])).catch(() => null);
  let stopped = false;
  const gone = device.onDisconnected(() => {
    if (!stopped) h.onDrop("The monitor disconnected.");
  });
  return {
    name: device.name ?? device.localName ?? "PM5",
    stop() {
      stopped = true;
      subs.forEach((s) => s.remove());
      gone.remove();
      device.cancelConnection().catch(() => null);
    },
  };
}

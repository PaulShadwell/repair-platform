// Direct browser-to-printer label printing via WebUSB (Chrome/Edge).
// Sends raw ESC/POS bytes to a USB printer's bulk OUT endpoint — no drivers,
// no CUPS queue, no local agent required on the POS computer.

// Minimal WebUSB type declarations (not part of the standard TS DOM lib).
interface UsbEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
}
interface UsbAlternateInterface {
  interfaceClass: number;
  endpoints: UsbEndpoint[];
}
interface UsbInterface {
  interfaceNumber: number;
  alternate: UsbAlternateInterface;
  claimed: boolean;
}
interface UsbConfiguration {
  configurationValue: number;
  interfaces: UsbInterface[];
}
export interface UsbDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: UsbConfiguration | null;
  configurations: UsbConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ status: string; bytesWritten: number }>;
}
interface Usb {
  getDevices(): Promise<UsbDevice[]>;
  requestDevice(options: { filters: Array<Record<string, number>> }): Promise<UsbDevice>;
}

const USB_PRINTER_CLASS = 7;
const STORAGE_KEY = "rp_webusb_printer";

function getUsb(): Usb | null {
  const usb = (navigator as unknown as { usb?: Usb }).usb;
  return usb ?? null;
}

export function isWebUsbSupported(): boolean {
  return getUsb() !== null;
}

function rememberDevice(device: UsbDevice): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ vendorId: device.vendorId, productId: device.productId }),
  );
}

function getRememberedIds(): { vendorId: number; productId: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { vendorId?: number; productId?: number };
    if (typeof parsed.vendorId === "number" && typeof parsed.productId === "number") {
      return { vendorId: parsed.vendorId, productId: parsed.productId };
    }
  } catch {
    // Ignore corrupt storage.
  }
  return null;
}

export function forgetUsbPrinter(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Shows the browser device picker so the user can grant access to the printer.
 * Filters to the USB printer device class so only printers are listed.
 */
export async function requestUsbPrinter(): Promise<UsbDevice> {
  const usb = getUsb();
  if (!usb) throw new Error("WebUSB is not supported in this browser");
  const device = await usb.requestDevice({ filters: [{ classCode: USB_PRINTER_CLASS }] });
  rememberDevice(device);
  return device;
}

/**
 * Returns a previously granted printer without showing the picker,
 * or null if none is available (never paired, unplugged, or permission revoked).
 */
export async function getPairedUsbPrinter(): Promise<UsbDevice | null> {
  const usb = getUsb();
  if (!usb) return null;
  const devices = await usb.getDevices();
  if (devices.length === 0) return null;
  const remembered = getRememberedIds();
  if (remembered) {
    const match = devices.find(
      (d) => d.vendorId === remembered.vendorId && d.productId === remembered.productId,
    );
    if (match) return match;
  }
  const printerLike = devices.find((d) => findPrinterInterface(d) !== null);
  return printerLike ?? devices[0];
}

function findPrinterInterface(
  device: UsbDevice,
): { configurationValue: number; interfaceNumber: number; endpointNumber: number } | null {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      const alt = iface.alternate;
      const bulkOut = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
      if (!bulkOut) continue;
      if (alt.interfaceClass === USB_PRINTER_CLASS) {
        return {
          configurationValue: config.configurationValue,
          interfaceNumber: iface.interfaceNumber,
          endpointNumber: bulkOut.endpointNumber,
        };
      }
    }
  }
  // Fallback: any interface with a bulk OUT endpoint (some clones report a vendor class).
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      const bulkOut = iface.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
      if (bulkOut) {
        return {
          configurationValue: config.configurationValue,
          interfaceNumber: iface.interfaceNumber,
          endpointNumber: bulkOut.endpointNumber,
        };
      }
    }
  }
  return null;
}

export function usbPrinterDisplayName(device: UsbDevice): string {
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(" ");
  return name || `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
}

const CHUNK_SIZE = 16 * 1024;

/**
 * Writes raw ESC/POS bytes to the printer's bulk OUT endpoint.
 */
export async function printViaWebUsb(device: UsbDevice, payload: Uint8Array): Promise<void> {
  const target = findPrinterInterface(device);
  if (!target) {
    throw new Error("No printable USB interface found on the selected device");
  }
  if (!device.opened) {
    await device.open();
  }
  try {
    if (
      !device.configuration ||
      device.configuration.configurationValue !== target.configurationValue
    ) {
      await device.selectConfiguration(target.configurationValue);
    }
    await device.claimInterface(target.interfaceNumber);
    try {
      for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
        const chunk = payload.subarray(offset, Math.min(offset + CHUNK_SIZE, payload.length));
        const result = await device.transferOut(target.endpointNumber, chunk as BufferSource);
        if (result.status !== "ok") {
          throw new Error(`USB transfer failed with status "${result.status}"`);
        }
      }
    } finally {
      await device.releaseInterface(target.interfaceNumber).catch(() => undefined);
    }
  } finally {
    await device.close().catch(() => undefined);
  }
}

export function decodeBase64Payload(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

import * as zlib from "node:zlib";
import { nativeImage, NativeImage } from "electron";
import { SessionLightState } from "../daemon/types";

type RGBA = [number, number, number, number];

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const crc = zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Minimal raw-pixel canvas + PNG encoder — no image deps needed for a few small tray icons. */
class Canvas {
  private pixels: Buffer;

  constructor(private width: number, private height: number, bg: RGBA = [0, 0, 0, 0]) {
    this.pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) this.setAt(i, bg);
  }

  private setAt(i: number, [r, g, b, a]: RGBA): void {
    this.pixels[i * 4] = r;
    this.pixels[i * 4 + 1] = g;
    this.pixels[i * 4 + 2] = b;
    this.pixels[i * 4 + 3] = a;
  }

  private setPixel(x: number, y: number, color: RGBA): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.setAt(y * this.width + x, color);
  }

  fillRoundedRect(x0: number, y0: number, w: number, h: number, radius: number, color: RGBA): void {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const cornerX = x < x0 + radius ? x0 + radius : x >= x0 + w - radius ? x0 + w - radius - 1 : x;
        const cornerY = y < y0 + radius ? y0 + radius : y >= y0 + h - radius ? y0 + h - radius - 1 : y;
        const dx = x - cornerX;
        const dy = y - cornerY;
        if (dx * dx + dy * dy <= radius * radius) this.setPixel(x, y, color);
      }
    }
  }

  fillCircle(cx: number, cy: number, radius: number, color: RGBA): void {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        if (dx * dx + dy * dy <= radius * radius) this.setPixel(x, y, color);
      }
    }
  }

  toPng(): Buffer {
    const raw = Buffer.alloc(this.height * (1 + this.width * 4));
    let offset = 0;
    for (let y = 0; y < this.height; y++) {
      raw[offset++] = 0; // filter type: none
      const rowStart = y * this.width * 4;
      this.pixels.copy(raw, offset, rowStart, rowStart + this.width * 4);
      offset += this.width * 4;
    }
    const idat = zlib.deflateSync(raw);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    return Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", idat),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

function blend(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] * t + b[0] * (1 - t)),
    Math.round(a[1] * t + b[1] * (1 - t)),
    Math.round(a[2] * t + b[2] * (1 - t)),
    255,
  ];
}

const HOUSING: RGBA = [32, 32, 36, 255];
const UNLIT: RGBA = [66, 66, 70, 255];
const LAMP_COLORS: RGBA[] = [
  [220, 38, 38, 255], // 0: red
  [234, 179, 8, 255], // 1: yellow
  [34, 197, 94, 255], // 2: green
];

interface IconSpec {
  width: number;
  height: number;
  cornerRadius: number;
  lampRadius: number;
  lampY: number[];
}

// Constrained to fit the menu-bar row height, small by necessity.
const TRAY_SPEC: IconSpec = { width: 16, height: 26, cornerRadius: 4, lampRadius: 3.4, lampY: [6.5, 13, 19.5] };
// Dropdown rows have room to breathe — bigger and clearer than the tray icon.
const MENU_SPEC: IconSpec = { width: 26, height: 42, cornerRadius: 6, lampRadius: 5.6, lampY: [10.5, 21, 31.5] };

/** activeIndex: which lamp (0=red,1=yellow,2=green) is lit; null = no session tracked, all unlit. */
function drawTrafficLight(spec: IconSpec, activeIndex: 0 | 1 | 2 | null, dimmed: boolean): Buffer {
  const canvas = new Canvas(spec.width, spec.height);
  canvas.fillRoundedRect(1, 1, spec.width - 2, spec.height - 2, spec.cornerRadius, HOUSING);
  for (let i = 0; i < 3; i++) {
    const isActive = activeIndex === i;
    const color = isActive ? blend(LAMP_COLORS[i], HOUSING, dimmed ? 0.35 : 1) : UNLIT;
    canvas.fillCircle(spec.width / 2, spec.lampY[i], spec.lampRadius, color);
  }
  return canvas.toPng();
}

const STATE_TO_LAMP: Record<SessionLightState | "NONE", 0 | 1 | 2 | null> = {
  BLOCKED: 0,
  RUNNING: 1,
  IDLE: 2,
  NONE: null,
};

const cache = new Map<string, NativeImage>();

/** The steady (fully lit) menu-bar tray icon for a given aggregate state. */
export function iconFor(state: SessionLightState | "NONE"): NativeImage {
  return cachedIcon(TRAY_SPEC, "tray", state, false);
}

/** The dimmed tray variant — used as the "off" frame when blinking the active lamp. */
export function dimIconFor(state: SessionLightState | "NONE"): NativeImage {
  return cachedIcon(TRAY_SPEC, "tray", state, true);
}

/** Bigger, clearer variant for dropdown menu-item icons, where space isn't as tight. */
export function menuIconFor(state: SessionLightState | "NONE"): NativeImage {
  return cachedIcon(MENU_SPEC, "menu", state, false);
}

/** Dimmed big variant — the "off" blink frame for a BLOCKED row's icon while the dropdown is open. */
export function menuDimIconFor(state: SessionLightState | "NONE"): NativeImage {
  return cachedIcon(MENU_SPEC, "menu", state, true);
}

function cachedIcon(spec: IconSpec, sizeKey: string, state: SessionLightState | "NONE", dimmed: boolean): NativeImage {
  const key = `${sizeKey}:${state}:${dimmed}`;
  const cached = cache.get(key);
  if (cached) return cached;
  // Not a "template" image: macOS forces template images to monochrome for
  // menu-bar theming, which would erase the red/yellow/green distinction.
  const image = nativeImage.createFromBuffer(drawTrafficLight(spec, STATE_TO_LAMP[state], dimmed));
  cache.set(key, image);
  return image;
}

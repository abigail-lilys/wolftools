import { describe, expect, it, vi } from "vitest";
import {
  BROWSER_WODITOR_RESOLUTION_OFFSET,
  patchBrowserWoditorResolution,
  patchResolutionPair,
} from "../src/browser-woditor-resolution.mjs";

describe("Browser Woditor JoiPlay resolution fix", () => {
  it("changes 1280x960 to 1920x1080 without changing buffer length", () => {
    const src = Buffer.alloc(64, 0xa5);
    src.writeUInt32LE(1280, 16);
    src.writeUInt32LE(960, 20);
    const before = Buffer.from(src);
    const out = patchResolutionPair(src, 16);

    expect(out.readUInt32LE(16)).toBe(1920);
    expect(out.readUInt32LE(20)).toBe(1080);
    expect(out.length).toBe(src.length);
    expect(src.equals(before)).toBe(true);
  });

  it("uses the verified file offset", () => {
    expect(BROWSER_WODITOR_RESOLUTION_OFFSET).toBe(0x829190);
  });

  it("refuses unexpected values", () => {
    const src = Buffer.alloc(64);
    src.writeUInt32LE(1600, 16);
    src.writeUInt32LE(800, 20);
    expect(() => patchResolutionPair(src, 16))
      .toThrow(/Unexpected WASM resolution values/);
  });

  it("refuses an out-of-bounds offset", () => {
    expect(() => patchResolutionPair(Buffer.alloc(32), 28))
      .toThrow(/too short/);
  });

  it("skips an unknown runtime without modifying it", () => {
    const src = Buffer.from("custom Browser Woditor runtime");
    const spy = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      expect(patchBrowserWoditorResolution(src)).toBe(src);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

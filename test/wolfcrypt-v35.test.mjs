import { describe, expect, it } from "vitest";
import {
  applyWolfCryptV35,
  msvcRandSequence,
  prepareWolfV35Archive,
} from "../src/archive/wolfcrypt-v35.mjs";

describe("WOLF v3.50 crypto primitives", () => {
  it("matches the MSVC rand sequence for seed 1", () => {
    expect(msvcRandSequence(1, 5)).toEqual([41, 18467, 6334, 26500, 19169]);
  });

  it("applies the same stream transform twice to restore bytes", () => {
    const key = Buffer.alloc(768);
    for (let i = 0; i < key.length; i += 1) key[i] = (i * 37 + 11) & 0xff;
    const source = Buffer.from(Array.from({ length: 513 }, (_, i) => (i * 19 + 7) & 0xff));
    const encrypted = applyWolfCryptV35(source, key, 64);
    expect(encrypted.equals(source)).toBe(false);
    expect(applyWolfCryptV35(encrypted, key, 64).equals(source)).toBe(true);
  });

  it("does not mistake v3.31 for the v3.50 preprocessing path", () => {
    const archive = Buffer.alloc(1200);
    archive.write("DX", 0, "ascii");
    archive.writeUInt16LE(8, 2);
    archive.writeUInt32LE(0x014b0000, 44);
    expect(() => prepareWolfV35Archive(archive)).toThrow(/Expected WOLF crypt version/);
  });
});

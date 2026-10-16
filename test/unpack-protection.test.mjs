import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeUnpackProtection } from "../src/archive/unpack-protection.mjs";

const prefix = Buffer.from(
  "Extracting data from encrypted files violates the guidelines.\0",
  "ascii",
);
const payload = Buffer.from([0x57, 0x4f, 0x4c, 0x46, 0x00, 0xff]);

async function checkFile(name, contents, check) {
  const dir = await mkdtemp(join(tmpdir(), "wolftools-test-"));
  const path = join(dir, name);

  try {
    await writeFile(path, contents);
    await removeUnpackProtection(path);
    await check(await readFile(path));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("WOLF v3.50 unpack protection", () => {
  it.each([
    "Game.dat",
    "CDataBase.dat",
    "DataBase.dat",
    "CommonEvent.dat",
  ])("removes the protection prefix from %s", async (name) => {
    await checkFile(
      name,
      Buffer.concat([prefix, payload]),
      (result) => expect(result).toEqual(payload),
    );
  });

  it("leaves unrelated files unchanged", async () => {
    const original = Buffer.concat([prefix, payload]);
    await checkFile(
      "Other.dat",
      original,
      (result) => expect(result).toEqual(original),
    );
  });

  it("leaves target files unchanged when the prefix does not match", async () => {
    const original = Buffer.concat([
      Buffer.from("Different header\0", "ascii"),
      payload,
    ]);
    await checkFile(
      "Game.dat",
      original,
      (result) => expect(result).toEqual(original),
    );
  });
});

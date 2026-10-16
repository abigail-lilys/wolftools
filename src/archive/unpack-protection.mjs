import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const UNPACK_PROTECTION_FILES = new Set([
  "game.dat",
  "cdatabase.dat",
  "database.dat",
  "commonevent.dat",
]);

const ANTI_UNPACK_DATA = Buffer.from(
  "Extracting data from encrypted files violates the guidelines.\0",
  "ascii",
);

export async function removeUnpackProtection(outputPath) {
  if (!UNPACK_PROTECTION_FILES.has(basename(outputPath).toLowerCase())) {
    return;
  }

  const data = await readFile(outputPath);

  if (
    data.length >= ANTI_UNPACK_DATA.length &&
    data.subarray(0, ANTI_UNPACK_DATA.length).equals(ANTI_UNPACK_DATA)
  ) {
    await writeFile(outputPath, data.subarray(ANTI_UNPACK_DATA.length));
  }
}

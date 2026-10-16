import { createHash } from "node:crypto";

export const BROWSER_WODITOR_WASM_SOURCE_SHA256 =
  "95885d4527086cc18d92bfe3ca7e206b8769444ffa4a9c035c24f637c3e93ace";
export const BROWSER_WODITOR_WASM_PATCHED_SHA256 =
  "8e05c81b155384b612a1de4c46181c98303df7740601796f5ec5e5158287f135";
export const BROWSER_WODITOR_RESOLUTION_OFFSET = 0x829190;

export function patchResolutionPair(
  bytes,
  offset = BROWSER_WODITOR_RESOLUTION_OFFSET,
) {
  if (!Buffer.isBuffer(bytes)) {
    throw new TypeError("WASM content must be a Buffer.");
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || bytes.length < offset + 8) {
    throw new Error("WASM is too short for the resolution patch.");
  }

  const width = bytes.readUInt32LE(offset);
  const height = bytes.readUInt32LE(offset + 4);
  if (width !== 1280 || height !== 960) {
    throw new Error(
      `Unexpected WASM resolution values ${width}x${height}; refusing to patch.`,
    );
  }

  const patched = Buffer.from(bytes);
  patched.writeUInt32LE(1920, offset);
  patched.writeUInt32LE(1080, offset + 4);
  return patched;
}

export function patchBrowserWoditorResolution(bytes) {
  const sha = createHash("sha256").update(bytes).digest("hex");

  if (sha === BROWSER_WODITOR_WASM_PATCHED_SHA256) return bytes;

  if (sha !== BROWSER_WODITOR_WASM_SOURCE_SHA256) {
    process.stdout.write(
      `WASM resolution patch skipped: unrecognized SHA-256 ${sha}\n`,
    );
    return bytes;
  }

  const patched = patchResolutionPair(bytes);
  const patchedSha = createHash("sha256").update(patched).digest("hex");
  if (patchedSha !== BROWSER_WODITOR_WASM_PATCHED_SHA256) {
    throw new Error(`WASM patch verification failed: ${patchedSha}`);
  }

  process.stdout.write(
    "Applied JoiPlay resolution patch: 1280x960 -> 1920x1080.\n",
  );
  return patched;
}

const V35 = 0x015e;
const HEADER_SIZE = 64;
const KEY_SIZE = 16;
const IV_SIZE = 16;
const ROUND_KEY_SIZE = 176;
const PW_SIZE = 15;
const BLOCKLEN = 16;

const SBOX = Uint8Array.from([
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);
const RCON = Uint8Array.from([0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36]);

function rotR8(value, count) {
  const n = count & 7;
  const v = value & 0xff;
  return ((v >>> n) | (v << (8 - n))) & 0xff;
}
function msvcRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 214013) + 2531011) >>> 0;
    return (state >>> 16) & 0x7fff;
  };
}
export function msvcRandSequence(seed, count) {
  const rand = msvcRandom(seed);
  return Array.from({ length: count }, () => rand());
}
function createXorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 11;
    state >>>= 0;
    state ^= state >>> 19;
    state >>>= 0;
    state ^= state << 7;
    state >>>= 0;
    return state;
  };
}
function applyWolfCryptInPlace(data, key, start = 0) {
  const modded = Buffer.alloc(512);
  for (let i = 0; i < 512; i += 1) modded[i] = key[i & 255] ^ (7 * i);
  let v1 = start % 256;
  let v2 = Math.floor(start / 256) % 256;
  for (let i = 0; i < data.length; i += 1) {
    data[i] ^= modded[v1] ^ modded[v2 + 256];
    v1 += 1;
    if (v1 === 256) {
      v1 = 0;
      v2 = (v2 + 1) % 256;
    }
  }
  return data;
}
export function applyWolfCryptV35(source, key, start = 0) {
  const out = Buffer.from(source);
  return applyWolfCryptInPlace(out, key, start);
}
function calcSalt958() {
  const text = Buffer.from("958", "ascii");
  const salt = Buffer.alloc(128);
  for (let i = 0; i < salt.length; i += 1) salt[i] = Math.floor(i / text.length) + text[i % text.length];
  return salt;
}
function createSpecialKey(password, other) {
  const p = password;
  let s3 = 0;
  const length = other ? Math.floor(p[8] / 4) : Math.floor(p[11] / 3);
  const rotate = other ? 2 : 3;
  for (let i = 0; i < length; i += 1) s3 = (i ^ rotR8(s3 ^ p[i % 15], rotate)) & 0xff;
  // The C++ implementation uses s0 * s1 + s2 + s3, with s1 = password[5].
  const rand = msvcRandom((Math.imul(p[2], p[5]) + p[12] + s3) >>> 0);
  const fac = [0, 0, 0];
  fac[s3 % 3] = rand() % 256;
  if (!other) fac[1] = rand() % 0xfb;
  const key = Buffer.alloc(768);
  for (let i = 0; i < 256; i += 1) {
    const rn = rand() & 0xffff;
    key[i] = fac[0] ^ (rand() & 0xff);
    key[i + 256] = fac[1] ^ (rn >>> 8);
    key[i + 512] = fac[2] ^ rn;
  }
  if (other) {
    const salt = calcSalt958();
    s3 = (s3 + 0x22) & 0xff;
    const modFactor = 16;
    for (let i = 0; i < 3; i += 1) {
      let t = s3;
      for (let j = 0; j < 256; j += 1) {
        let skip = false;
        const curS = salt[j & 0x7f];
        const curS2 = salt[(j + i) % 0x80];
        const curK = key[i * 256 + j];
        const sXk = curS ^ curK;
        const round = (curS2 | (curS << 8)) % modFactor;
        let newK = sXk;
        switch (round) {
          case 1: if (curS2 % 0x0b === 0) newK = curK; break;
          case 2: if (curS % 0x1d === 0) newK = (~sXk) & 0xff; break;
          case 3: if ((round + j) % 0x25 === 0) newK = curS2 ^ sXk; break;
          case 4: if ((curS + curS2) % 97 === 0) newK = curS + sXk; break;
          case 5: if ((j * round) % 0x7b === 0) newK = sXk ^ t; break;
          case 6:
            if (curS === 0xff && curS2 === 0) { newK = 0; skip = true; }
            break;
          case 7:
            if (((round + j) % 0x33) === 0) newK ^= curS;
            break;
          case 8:
            if ((curS % 0x1d) === 0) newK ^= curS;
            break;
          default: break;
        }
        if (((j + i) % (curS % 5 + 1)) === 0) newK ^= t;
        else if (skip) newK = (~sXk) & 0xff;
        key[i * 256 + j] = newK & 0xff;
        t += i;
      }
    }
  }
  return key;
}
function cryptAddressesV35InPlace(header, password) {
  const seed = (0x0c + password[9] * password[10] + password[3]) >>> 0;
  const rand = msvcRandom(seed);
  for (let base = 8; base <= 16; base += 8) {
    for (let index = 3; index >= 0; index -= 1) {
      const offset = base + index * 2;
      header.writeUInt16LE(header.readUInt16LE(offset) ^ (rand() & 0xffff), offset);
    }
  }
  const r0 = BigInt(rand()) << 17n;
  const r1 = BigInt(rand()) << 31n;
  const v0 = Number(((r0 & 0xffffffffn) | (r1 & 0xffffffffn) | BigInt(rand())) & 0xffffffffn) >>> 0;
  const v1 = Number(((r0 >> 32n) | (r1 >> 32n)) & 0xffffffffn) >>> 0;
  header.writeUInt32LE((header.readUInt32LE(24) ^ v0) >>> 0, 24);
  header.writeUInt32LE((header.readUInt32LE(28) ^ v1) >>> 0, 28);
  for (let index = 3; index >= 0; index -= 1) {
    const offset = 32 + index * 2;
    header.writeUInt16LE(header.readUInt16LE(offset) ^ (rand() & 0xffff), offset);
  }
}
function aesMixColumns(state) {
  for (let col = 0; col < 4; col += 1) {
    const i = col * 4;
    const a = state[i], b = state[i + 1], c = state[i + 2], d = state[i + 3];
    const total = a ^ b ^ c ^ d;
    const xt = (x) => (((x << 1) ^ ((x & 0x80) ? 0x1b : 0)) & 0xff);
    state[i] = a ^ total ^ xt(a ^ b);
    state[i + 1] = b ^ total ^ xt(b ^ c);
    state[i + 2] = c ^ total ^ xt(c ^ d);
    state[i + 3] = d ^ total ^ xt(d ^ a);
  }
}
function aesShiftRows(state) {
  let temp = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = temp;
  temp = state[2]; state[2] = state[10]; state[10] = temp;
  temp = state[6]; state[6] = state[14]; state[14] = temp;
  temp = state[3]; state[3] = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = temp;
}
function aesCipher(block, roundKey) {
  const state = Buffer.from(block);
  for (let i = 0; i < 16; i += 1) state[i] ^= roundKey[i];
  for (let round = 1; round < 10; round += 1) {
    for (let i = 0; i < 16; i += 1) state[i] = SBOX[state[i]];
    aesShiftRows(state);
    aesMixColumns(state);
    const base = round * 16;
    for (let i = 0; i < 16; i += 1) state[i] ^= roundKey[base + i];
  }
  for (let i = 0; i < 16; i += 1) state[i] = SBOX[state[i]];
  aesShiftRows(state);
  for (let i = 0; i < 16; i += 1) state[i] ^= roundKey[160 + i];
  return state;
}
function initAes128(password) {
  const proKey = Buffer.alloc(4);
  const key = Buffer.alloc(KEY_SIZE);
  const iv = Buffer.alloc(IV_SIZE);
  for (let i = 0; i < PW_SIZE; i += 1) {
    const proKeyElem = proKey[i % 4];
    const pwIdxKey = (((i * ((proKeyElem % 5) + 7)) ^ (3 * password[i])) % PW_SIZE) >>> 0;
    const pwIdxIv = (((i * ((proKey[(i + 1) % 4] % 7) + 0x0b)) ^ (5 * password[(i + 3) % 15])) % PW_SIZE) >>> 0;
    key[i] ^= (((i ^ proKeyElem) + (password[pwIdxKey] << (i % 3))) % 0xfb) & 0xff;
    iv[i] ^= ((password[pwIdxIv] >>> (i % 2)) + ((i * i) ^ proKey[(i + 2) % 4])) % 0xf6;
    key[PW_SIZE] ^= (7 * (password[i] + ((i + 1) ^ proKeyElem))) % 0xfd;
    const u16 = (password[i] - ((i * 2) ^ proKey[(i + 2) % 4])) & 0xffff;
    iv[PW_SIZE] ^= (11 * u16) % 0x100;
  }
  const roundKey = Buffer.alloc(ROUND_KEY_SIZE + IV_SIZE);
  for (let i = 0; i < 16; i += 1) roundKey[i] = key[i];
  for (let i = 4; i < 44; i += 1) {
    const j = (i - 1) * 4;
    let t = [roundKey[j], roundKey[j + 1], roundKey[j + 2], roundKey[j + 3]];
    if ((i % 4) === 0) {
      t = [t[1], t[2], t[3], t[0]];
      t[0] = SBOX[t[0]] ^ RCON[i / 4];
      t[1] = SBOX[t[1]] >>> 4;
      t[2] = (~SBOX[t[2]]) & 0xff;
      t[3] = rotR8(SBOX[t[3]], 7);
    }
    const prev = (i - 4) * 4;
    for (let k = 0; k < 4; k += 1) roundKey[i * 4 + k] = roundKey[prev + k] ^ t[k];
  }
  iv.copy(roundKey, ROUND_KEY_SIZE);
  return roundKey;
}
function aesCtrXCryptInPlace(data, dataOffset, size, roundKey) {
  const ivOffset = ROUND_KEY_SIZE;
  let state;
  let bi = BLOCKLEN;
  for (let i = 0; i < size; i += 1) {
    if (bi === BLOCKLEN) {
      state = aesCipher(roundKey.subarray(ivOffset, ivOffset + 16), roundKey);
      for (let k = 15; k >= 0; k -= 1) {
        if (roundKey[ivOffset + k] === 0xff) {
          roundKey[ivOffset + k] = 0;
          continue;
        }
        roundKey[ivOffset + k] += 1;
        break;
      }
      bi = 0;
    }
    data[dataOffset + i] ^= state[bi++];
  }
}
function getHeaderPassword(archive) {
  return Buffer.from(archive.subarray(49, 64));
}

export function prepareWolfV35Archive(archive) {
  if (!Buffer.isBuffer(archive) || archive.length < 0x400 + HEADER_SIZE) {
    throw new Error("The WOLF v3.50 archive is too small for crypt preprocessing.");
  }
  if (archive.toString("ascii", 0, 2) !== "DX" || archive.readUInt16LE(2) !== 8) {
    throw new Error("Not a DX version 8 archive.");
  }
  const version = archive.readUInt32LE(44) >>> 16;
  if (version !== V35) throw new Error(`Expected WOLF crypt version 0x15e, got 0x${version.toString(16)}.`);
  const password = getHeaderPassword(archive);
  // The original archive is already a private in-memory copy, so mutate it in place.
  cryptAddressesV35InPlace(archive, password);
  const size = archive.length;
  const headNameTableStart = Number(archive.readBigUInt64LE(16));
  if (!Number.isSafeInteger(headNameTableStart) || headNameTableStart < HEADER_SIZE || headNameTableStart >= size) {
    throw new Error("The decrypted WOLF v3.50 name-table address is invalid.");
  }
  const initialKey = createSpecialKey(password, true);
  // Matches UberWolf's call: initWolfCrypt(..., pFileData, 64, size - 64, true, ...).
  applyWolfCryptInPlace(archive.subarray(HEADER_SIZE, size - HEADER_SIZE), initialKey, HEADER_SIZE);
  const roundKey = initAes128(password);
  const rand = createXorshift32((Math.imul(password[2], password[4]) + password[12]) >>> 0 || 1);
  rand();
  if (size >= (rand() % 500) + 800) rand();
  let bodySize = size - HEADER_SIZE;
  if (bodySize >= (rand() % 500) + 800) bodySize = (rand() % 500) + 800;
  aesCtrXCryptInPlace(archive, HEADER_SIZE, bodySize, roundKey);
  aesCtrXCryptInPlace(archive, headNameTableStart, size - headNameTableStart, roundKey);
  const specialKey = createSpecialKey(password, false);
  return { archive, specialKey, cryptVersion: V35 };
}

import { createHash, createPublicKey, verify } from "node:crypto";

/**
 * NEP-413: proving control of a NEAR account by signing a message off-chain.
 * https://github.com/near/NEPs/blob/master/neps/nep-0413.md
 *
 * The wallet signs SHA-256(borsh(tag, payload)) with one of the account's keys.
 * A valid signature proves control of that key only. The caller must also
 * confirm on-chain that the key is a full-access key of the claimed account
 * (`ChainReader.hasFullAccessKey`); otherwise anyone could sign with their own
 * key and name someone else's account.
 *
 * Pure: no network, no database.
 */

/** 2^31 + 413, written before the payload so a signed message can never be a transaction. */
const NEP413_TAG = 2 ** 31 + 413;

export interface Nep413Payload {
  message: string;
  /** Exactly 32 bytes, chosen by the server and used once. */
  nonce: Uint8Array;
  recipient: string;
  callbackUrl?: string | null;
}

function u32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value);
  return out;
}

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([u32(bytes.length), bytes]);
}

/** The exact bytes a NEP-413 wallet hashes and signs. */
export function nep413SigningHash(payload: Nep413Payload): Buffer {
  if (payload.nonce.length !== 32) throw new RangeError("The nonce must be 32 bytes.");
  const callback =
    payload.callbackUrl == null
      ? Buffer.from([0])
      : Buffer.concat([Buffer.from([1]), borshString(payload.callbackUrl)]);
  const bytes = Buffer.concat([
    u32(NEP413_TAG),
    borshString(payload.message),
    Buffer.from(payload.nonce),
    borshString(payload.recipient),
    callback,
  ]);
  return createHash("sha256").update(bytes).digest();
}

const ZERO = BigInt(0);
const BASE = BigInt(58);
const BYTE = BigInt(256);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(value: string): Uint8Array | null {
  if (value.length === 0) return null;
  let number = BigInt(0);
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    number = number * BASE + BigInt(digit);
  }
  const bytes: number[] = [];
  while (number > ZERO) {
    bytes.unshift(Number(number % BYTE));
    number /= BYTE;
  }
  for (const character of value) {
    if (character !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** `ed25519:<base58>` → the 32 raw key bytes. Other key types are refused. */
export function parseEd25519PublicKey(value: string): Uint8Array | null {
  if (!value.startsWith("ed25519:")) return null;
  const raw = base58Decode(value.slice("ed25519:".length));
  return raw && raw.length === 32 ? raw : null;
}

/** Wallets return the signature as Base64; some return Base58. */
function decodeSignature(value: string): Uint8Array | null {
  const body = value.startsWith("ed25519:") ? value.slice(8) : value;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    const fromBase64 = Buffer.from(body, "base64");
    if (fromBase64.length === 64) return fromBase64;
  }
  const fromBase58 = base58Decode(body);
  return fromBase58 && fromBase58.length === 64 ? fromBase58 : null;
}

/** True when `signature` is a valid ed25519 signature of the payload by `publicKey`. */
export function verifyNep413Signature(input: {
  payload: Nep413Payload;
  publicKey: string;
  signature: string;
}): boolean {
  const key = parseEd25519PublicKey(input.publicKey);
  const signature = decodeSignature(input.signature);
  if (!key || !signature) return false;
  try {
    const publicKey = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key).toString("base64url") },
      format: "jwk",
    });
    return verify(null, nep413SigningHash(input.payload), publicKey, signature);
  } catch {
    return false;
  }
}

import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  base58Decode,
  nep413SigningHash,
  parseEd25519PublicKey,
  verifyNep413Signature,
  type Nep413Payload,
} from "@/lib/near/nep413";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let number = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let out = "";
  while (number > BigInt(0)) {
    out = ALPHABET[Number(number % BigInt(58))] + out;
    number /= BigInt(58);
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out;
}

/** A wallet stand-in: a fresh ed25519 key that signs NEP-413 payloads. */
function wallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url");
  return {
    publicKey: `ed25519:${base58Encode(raw)}`,
    sign: (payload: Nep413Payload) =>
      sign(null, nep413SigningHash(payload), privateKey).toString("base64"),
  };
}

const payload: Nep413Payload = {
  message: "Prove that daniel.testnet belongs to you on ProofMe.",
  nonce: new Uint8Array(32).fill(7),
  recipient: "proofme-nine.vercel.app",
};

describe("NEP-413 signed messages", () => {
  it("accepts a signature over exactly this payload", () => {
    const key = wallet();
    expect(
      verifyNep413Signature({ payload, publicKey: key.publicKey, signature: key.sign(payload) }),
    ).toBe(true);
  });

  it("rejects the signature when any field differs", () => {
    const key = wallet();
    const signature = key.sign(payload);
    for (const changed of [
      { ...payload, message: payload.message + " " },
      { ...payload, nonce: new Uint8Array(32).fill(8) },
      { ...payload, recipient: "evil.example" },
      { ...payload, callbackUrl: "https://evil.example" },
    ]) {
      expect(verifyNep413Signature({ payload: changed, publicKey: key.publicKey, signature })).toBe(
        false,
      );
    }
  });

  it("rejects a signature made by a different key", () => {
    const signer = wallet();
    const other = wallet();
    expect(
      verifyNep413Signature({
        payload,
        publicKey: other.publicKey,
        signature: signer.sign(payload),
      }),
    ).toBe(false);
  });

  it("rejects malformed keys and signatures instead of throwing", () => {
    const key = wallet();
    expect(verifyNep413Signature({ payload, publicKey: "secp256k1:abc", signature: "x" })).toBe(
      false,
    );
    expect(verifyNep413Signature({ payload, publicKey: key.publicKey, signature: "not!b64" })).toBe(
      false,
    );
    expect(parseEd25519PublicKey("ed25519:0OIl")).toBeNull();
  });

  it("refuses a nonce that is not 32 bytes", () => {
    expect(() => nep413SigningHash({ ...payload, nonce: new Uint8Array(16) })).toThrow();
  });

  it("decodes Base58 with leading zero bytes", () => {
    expect(Array.from(base58Decode("11") ?? [])).toEqual([0, 0]);
    expect(Buffer.from(base58Decode(base58Encode(Buffer.from("proofme"))) ?? []).toString()).toBe(
      "proofme",
    );
  });
});

describe("keys whose first byte is zero", () => {
  it("still verify (Base58 keeps leading zero bytes as '1')", () => {
    // Search for a key starting with a zero byte; about 1 in 256 do.
    for (let attempt = 0; attempt < 5000; attempt += 1) {
      const key = wallet();
      if (!key.publicKey.startsWith("ed25519:1")) continue;
      expect(
        verifyNep413Signature({ payload, publicKey: key.publicKey, signature: key.sign(payload) }),
      ).toBe(true);
      return;
    }
    throw new Error("no key with a leading zero byte found");
  });
});

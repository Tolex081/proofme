import { describe, expect, it } from "vitest";

import {
  ChainUnavailableError,
  createRpcChainReader,
  isValidAccountId,
  isValidTransactionHash,
} from "@/lib/near/chain";

const CONTRACT = "attestations.proofme.testnet";
const bytes = (value: unknown) => Array.from(Buffer.from(JSON.stringify(value), "utf8"));
const base64 = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");

/** A reader whose network answers with whatever `answer` returns for each request. */
function readerWith(
  answer: (body: { method: string; params: Record<string, unknown> }) => unknown,
) {
  const requests: { method: string; params: Record<string, unknown> }[] = [];
  const reader = createRpcChainReader({
    rpcUrl: "https://rpc.example.test",
    contractId: CONTRACT,
    fetch: (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      requests.push(body);
      const result = answer(body);
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result), { status: 200 });
    }) as typeof fetch,
  });
  return { reader, requests };
}

const TOKEN = "5d7c1c0e-2f4a-4d53-8f43-0a6f3f1f9b01";
const ON_CHAIN = {
  token_id: TOKEN,
  owner_id: "alice.testnet",
  issuer_id: "northstar.testnet",
  organisation_id: "0b5f2a52-6c0f-4b7e-9d0a-3a1d9f5e7c11",
  issuer_status: "active",
  digest: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  issued_at: 1_800_000_000_000,
  status: "revoked",
  status_changed_at: 1_800_000_060_000,
  supersedes: null,
  superseded_by: null,
};

describe("account IDs and transaction hashes", () => {
  it("accepts real account shapes", () => {
    for (const value of ["alice.testnet", "a1", "proofme-attest_1.testnet", "a".repeat(64)]) {
      expect(isValidAccountId(value)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const value of ["", "a", "Alice.testnet", "a..b", ".a", "a.", "a b", "a".repeat(65)]) {
      expect(isValidAccountId(value)).toBe(false);
    }
  });

  it("recognises a transaction hash", () => {
    expect(isValidTransactionHash("9av2U6cova7LZPA9NPij6CTUrpBbgPG6LKVkyhcsqGk3")).toBe(true);
    expect(isValidTransactionHash("not-a-hash")).toBe(false);
    expect(isValidTransactionHash("0".repeat(44))).toBe(false);
  });
});

describe("reading the contract", () => {
  it("asks for final state and decodes an attestation", async () => {
    const { reader, requests } = readerWith(() => ({ result: { result: bytes(ON_CHAIN) } }));
    const attestation = await reader.getAttestation(TOKEN);
    expect(attestation).toMatchObject({
      tokenId: TOKEN,
      ownerId: "alice.testnet",
      issuerId: "northstar.testnet",
      status: "revoked",
      issuerStatus: "active",
    });
    expect(attestation!.statusChangedAt.toISOString()).toBe("2027-01-15T08:01:00.000Z");
    expect(requests[0].method).toBe("query");
    expect(requests[0].params).toMatchObject({
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT,
      method_name: "get_attestation",
      args_base64: base64({ token_id: TOKEN }),
    });
  });

  it("returns null for a token or issuer the contract does not know", async () => {
    const { reader } = readerWith(() => ({ result: { result: bytes(null) } }));
    expect(await reader.getAttestation(TOKEN)).toBeNull();
    expect(await reader.getIssuer("nobody.testnet")).toBeNull();
  });

  it("decodes an issuer", async () => {
    const { reader } = readerWith(() => ({
      result: {
        result: bytes({ organisation_id: "org-1", status: "suspended", registered_at: 1 }),
      },
    }));
    expect(await reader.getIssuer("northstar.testnet")).toEqual({
      organisationId: "org-1",
      status: "suspended",
    });
  });

  it("treats an unreachable or failing network as unavailable, never as an answer", async () => {
    const failing = [
      readerWith(() => new Response("nope", { status: 503 })),
      readerWith(() => new Response("not json", { status: 200 })),
      readerWith(() => ({ error: { name: "HANDLER_ERROR" } })),
      readerWith(() => {
        throw new Error("offline");
      }),
    ];
    for (const { reader } of failing) {
      await expect(reader.getAttestation(TOKEN)).rejects.toBeInstanceOf(ChainUnavailableError);
    }
  });
});

describe("reading a transaction", () => {
  const transaction = (status: unknown) => ({
    result: {
      status,
      transaction: {
        hash: "9av2U6cova7LZPA9NPij6CTUrpBbgPG6LKVkyhcsqGk3",
        signer_id: "northstar.testnet",
        receiver_id: CONTRACT,
        actions: [
          { FunctionCall: { method_name: "issue", args: base64({ token_id: TOKEN }) } },
          { Transfer: { deposit: "1" } },
        ],
      },
    },
  });

  it("reports the signer, receiver, calls and success", async () => {
    const { reader, requests } = readerWith(() => transaction({ SuccessValue: "" }));
    const result = await reader.getTransaction("hash", "northstar.testnet");
    expect(result).toEqual({
      hash: "9av2U6cova7LZPA9NPij6CTUrpBbgPG6LKVkyhcsqGk3",
      signerId: "northstar.testnet",
      receiverId: CONTRACT,
      succeeded: true,
      calls: [{ methodName: "issue", args: { token_id: TOKEN } }],
    });
    expect(requests[0].params).toMatchObject({ wait_until: "FINAL" });
  });

  it("reports a failed transaction as not succeeded", async () => {
    const { reader } = readerWith(() => transaction({ Failure: { ActionError: {} } }));
    expect((await reader.getTransaction("hash", "northstar.testnet"))!.succeeded).toBe(false);
  });

  it("returns null for a transaction the network does not know", async () => {
    const { reader } = readerWith(() => ({
      error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_TRANSACTION" } },
    }));
    expect(await reader.getTransaction("hash", "northstar.testnet")).toBeNull();
  });
});

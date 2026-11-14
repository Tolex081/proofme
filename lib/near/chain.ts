import { z } from "zod";

/**
 * Reading the Atesta attestations contract on NEAR.
 *
 * The server holds no NEAR key and never signs anything: minting and revoking
 * are signed in the organisation's own wallet. Everything here is a read, used
 * to confirm what actually happened on-chain before the database records it.
 *
 * `ChainReader` is an interface so services can be tested with a stand-in.
 */

/** NEAR account IDs: 2 to 64 characters, lowercase, separated by single `.`, `-` or `_`. */
const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isValidAccountId(value: string): boolean {
  return ACCOUNT_ID.test(value);
}

/** Transaction hashes are base58, 43 or 44 characters. */
const TRANSACTION_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export function isValidTransactionHash(value: string): boolean {
  return TRANSACTION_HASH.test(value);
}

const attestationStatus = z.enum(["active", "revoked", "superseded"]);
const issuerStatus = z.enum(["active", "suspended"]);

const chainAttestationSchema = z.object({
  token_id: z.string(),
  owner_id: z.string(),
  issuer_id: z.string(),
  organisation_id: z.string(),
  issuer_status: issuerStatus,
  digest: z.string(),
  issued_at: z.number(),
  status: attestationStatus,
  status_changed_at: z.number(),
  supersedes: z.string().nullable(),
  superseded_by: z.string().nullable(),
  // Absent on tokens minted before references existed.
  reference: z.string().nullable().optional(),
  reference_hash: z.string().nullable().optional(),
});

const chainIssuerSchema = z.object({
  organisation_id: z.string(),
  status: issuerStatus,
  registered_at: z.number(),
});

export interface ChainAttestation {
  tokenId: string;
  ownerId: string;
  issuerId: string;
  organisationId: string;
  issuerStatus: "active" | "suspended";
  digest: string;
  issuedAt: Date;
  status: "active" | "revoked" | "superseded";
  statusChangedAt: Date;
  supersedes: string | null;
  supersededBy: string | null;
  /** NEP-177 `reference`: where the public credential document lives. */
  reference: string | null;
  /** Base64 SHA-256 of the document at `reference`. */
  referenceHash: string | null;
}

export interface ChainIssuer {
  organisationId: string;
  status: "active" | "suspended";
}

/** One contract call inside a transaction. */
export interface ChainFunctionCall {
  methodName: string;
  args: unknown;
}

export interface ChainTransaction {
  hash: string;
  signerId: string;
  receiverId: string;
  succeeded: boolean;
  calls: ChainFunctionCall[];
}

export interface ChainReader {
  readonly contractId: string;
  getAttestation(tokenId: string): Promise<ChainAttestation | null>;
  getIssuer(accountId: string): Promise<ChainIssuer | null>;
  /** Null when the network does not know the transaction. */
  getTransaction(hash: string, signerId: string): Promise<ChainTransaction | null>;
  /** True only if `publicKey` is a full-access key of `accountId` right now. */
  hasFullAccessKey(accountId: string, publicKey: string): Promise<boolean>;
  /** Every attestation the account holds (at most 100), with its current status. */
  getAttestationsForOwner(accountId: string): Promise<ChainAttestation[]>;
}

export class ChainUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainUnavailableError";
  }
}

function toChainAttestation(value: z.infer<typeof chainAttestationSchema>): ChainAttestation {
  return {
    tokenId: value.token_id,
    ownerId: value.owner_id,
    issuerId: value.issuer_id,
    organisationId: value.organisation_id,
    issuerStatus: value.issuer_status,
    digest: value.digest,
    issuedAt: new Date(value.issued_at),
    status: value.status,
    statusChangedAt: new Date(value.status_changed_at),
    supersedes: value.supersedes,
    supersededBy: value.superseded_by,
    reference: value.reference ?? null,
    referenceHash: value.reference_hash ?? null,
  };
}

type Fetch = typeof fetch;

const rpcEnvelope = z.object({
  result: z.unknown().optional(),
  error: z
    .object({
      name: z.string().optional(),
      cause: z.object({ name: z.string().optional() }).optional(),
    })
    .passthrough()
    .optional(),
});

const viewResult = z.object({ result: z.array(z.number()) });

const transactionResult = z.object({
  status: z.unknown(),
  transaction: z.object({
    hash: z.string(),
    signer_id: z.string(),
    receiver_id: z.string(),
    actions: z.array(z.unknown()),
  }),
});

const functionCallAction = z.object({
  FunctionCall: z.object({ method_name: z.string(), args: z.string() }),
});

function decodeJson(base64: string): unknown {
  try {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function createRpcChainReader(options: {
  rpcUrl: string;
  contractId: string;
  fetch?: Fetch;
}): ChainReader {
  const send = options.fetch ?? fetch;
  const { rpcUrl, contractId } = options;

  async function rpc(method: string, params: unknown) {
    let response: Response;
    try {
      response = await send(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "proofme", method, params }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ChainUnavailableError("The NEAR network could not be reached.");
    }
    if (!response.ok) {
      throw new ChainUnavailableError(`The NEAR network answered with status ${response.status}.`);
    }
    const parsed = rpcEnvelope.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ChainUnavailableError("The NEAR network gave an unreadable answer.");
    }
    return parsed.data;
  }

  async function view(methodName: string, args: Record<string, unknown>): Promise<unknown> {
    const answer = await rpc("query", {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
    });
    const result = viewResult.safeParse(answer.result);
    if (!result.success) {
      throw new ChainUnavailableError(`The contract call ${methodName} failed.`);
    }
    return JSON.parse(Buffer.from(result.data.result).toString("utf8"));
  }

  return {
    contractId,

    async getAttestation(tokenId) {
      const raw = await view("get_attestation", { token_id: tokenId });
      if (raw === null) return null;
      return toChainAttestation(chainAttestationSchema.parse(raw));
    },

    async getAttestationsForOwner(accountId) {
      const tokens = z
        .array(z.object({ token_id: z.string() }))
        .parse(await view("nft_tokens_for_owner", { account_id: accountId, limit: 100 }));
      const found = await Promise.all(
        tokens.map(async (token) => {
          const raw = await view("get_attestation", { token_id: token.token_id });
          return raw === null ? null : toChainAttestation(chainAttestationSchema.parse(raw));
        }),
      );
      return found.filter((item): item is ChainAttestation => item !== null);
    },

    async hasFullAccessKey(accountId, publicKey) {
      const answer = await rpc("query", {
        request_type: "view_access_key",
        finality: "final",
        account_id: accountId,
        public_key: publicKey,
      });
      if (answer.error) {
        const text = JSON.stringify(answer.error);
        if (/UNKNOWN_ACCESS_KEY|UNKNOWN_ACCOUNT|INVALID_ACCOUNT|does not exist/i.test(text)) {
          return false;
        }
        throw new ChainUnavailableError("The NEAR network could not look up the key.");
      }
      const key = z.object({ permission: z.unknown() }).safeParse(answer.result);
      if (!key.success) {
        // Older nodes report a missing key as a result with an `error` field.
        return false;
      }
      return key.data.permission === "FullAccess";
    },

    async getIssuer(accountId) {
      const raw = await view("get_issuer", { issuer_id: accountId });
      if (raw === null) return null;
      const value = chainIssuerSchema.parse(raw);
      return { organisationId: value.organisation_id, status: value.status };
    },

    async getTransaction(hash, signerId) {
      const answer = await rpc("tx", {
        tx_hash: hash,
        sender_account_id: signerId,
        wait_until: "FINAL",
      });
      if (answer.error) {
        const name = answer.error.cause?.name ?? answer.error.name ?? "";
        if (/UNKNOWN_TRANSACTION|INVALID_TRANSACTION|PARSE_ERROR|REQUEST_VALIDATION/.test(name)) {
          return null;
        }
        throw new ChainUnavailableError("The NEAR network could not look up the transaction.");
      }
      const result = transactionResult.safeParse(answer.result);
      if (!result.success) return null;
      const status = result.data.status;
      const succeeded =
        typeof status === "object" && status !== null && "SuccessValue" in (status as object);
      const calls = result.data.transaction.actions.flatMap((action) => {
        const call = functionCallAction.safeParse(action);
        return call.success
          ? [
              {
                methodName: call.data.FunctionCall.method_name,
                args: decodeJson(call.data.FunctionCall.args),
              },
            ]
          : [];
      });
      return {
        hash: result.data.transaction.hash,
        signerId: result.data.transaction.signer_id,
        receiverId: result.data.transaction.receiver_id,
        succeeded,
        calls,
      };
    },
  };
}

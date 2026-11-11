"use client";

import type { NearConnector } from "@hot-labs/near-connect";

/**
 * The browser's connection to a NEAR wallet (Meteor and others), through
 * NEAR Connect. Loaded only when someone presses a wallet button: nothing
 * here runs on the server or on pages that do not use a wallet.
 *
 * ProofMe never sees a key or seed phrase. The wallet shows each transaction
 * to its owner and signs it there.
 */

let connector: Promise<NearConnector> | null = null;

function getConnector(): Promise<NearConnector> {
  connector ??= (async () => {
    const { NearConnector } = await import("@hot-labs/near-connect");
    const created = new NearConnector({ network: "testnet", features: { testnet: true } });
    await created.whenManifestLoaded;
    return created;
  })();
  return connector;
}

/** The account connected in this browser, if any. Never opens the wallet. */
export async function connectedAccount(): Promise<string | null> {
  try {
    const { accounts } = await (await getConnector()).getConnectedWallet();
    return accounts[0]?.accountId ?? null;
  } catch {
    return null;
  }
}

/** Opens the wallet picker and returns the account the person chose. */
export async function connectWallet(): Promise<string> {
  const wallet = await (await getConnector()).connect();
  const accounts = await wallet.getAccounts();
  const accountId = accounts[0]?.accountId;
  if (!accountId) throw new Error("No account was connected.");
  return accountId;
}

export async function disconnectWallet(): Promise<void> {
  try {
    await (await getConnector()).disconnect();
  } catch {
    // Already disconnected.
  }
}

/**
 * Makes sure the wallet connected here is `accountId`, asking the person to
 * connect or switch if it is not.
 */
export async function requireAccount(accountId: string): Promise<void> {
  let current = await connectedAccount();
  if (current === accountId) return;
  if (current) await disconnectWallet();
  current = await connectWallet();
  if (current !== accountId) {
    await disconnectWallet();
    throw new Error(
      `Connect ${accountId}, the organisation's NEAR account. You connected ${current}.`,
    );
  }
}

const GAS = "30000000000000"; // 30 Tgas

/**
 * Asks the wallet to sign one contract call and send it. Returns the
 * transaction hash, which the server then checks against the network.
 */
export async function callContract(input: {
  signerId: string;
  contractId: string;
  methodName: string;
  args: Record<string, unknown>;
  /** In yoctoNEAR. */
  deposit: string;
}): Promise<string> {
  const wallet = await (await getConnector()).wallet();
  const outcome = await wallet.signAndSendTransaction({
    network: "testnet",
    signerId: input.signerId,
    receiverId: input.contractId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: input.methodName,
          args: input.args,
          gas: GAS,
          deposit: input.deposit,
        },
      },
    ],
  });
  const transactionHash = outcome?.transaction?.hash;
  if (typeof transactionHash !== "string") {
    throw new Error("The wallet did not report a transaction.");
  }
  return transactionHash;
}

/** A short, human reason from whatever a wallet threw. */
export function walletErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/reject|cancel|denied|closed/i.test(text))
    return "You cancelled in the wallet. Nothing was sent.";
  return text.length > 0 && text.length < 220
    ? text
    : "The wallet could not complete that. Nothing was recorded.";
}

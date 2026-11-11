import "server-only";

import { getEnv } from "../env";
import { createRpcChainReader, type ChainReader } from "./chain";

export interface NearConfig {
  network: "testnet" | "sandbox";
  contractId: string;
  explorerBaseUrl: string;
}

/** Null until a contract has been deployed and configured. */
export function getNearConfig(): NearConfig | null {
  const env = getEnv();
  if (!env.NEAR_CONTRACT_ID) return null;
  return {
    network: env.NEAR_NETWORK,
    contractId: env.NEAR_CONTRACT_ID,
    explorerBaseUrl: env.NEAR_EXPLORER_BASE_URL.replace(/\/$/, ""),
  };
}

let reader: ChainReader | null | undefined;

/** Reads the configured contract. Null until one is configured. */
export function getChainReader(): ChainReader | null {
  if (reader === undefined) {
    const config = getNearConfig();
    reader = config
      ? createRpcChainReader({ rpcUrl: getEnv().NEAR_RPC_URL, contractId: config.contractId })
      : null;
  }
  return reader;
}

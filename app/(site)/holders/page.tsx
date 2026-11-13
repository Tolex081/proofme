import type { Metadata } from "next";

import { HolderGate } from "@/components/near/holder-gate";

export const metadata: Metadata = {
  title: "For credential holders",
  description:
    "A page only holders of a valid ProofMe credential NFT can open: an example of a credential granting access in another application.",
};

export default function Holders() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:py-14">
      <header>
        <p className="text-[0.9rem] font-semibold text-muted">Credential-gated</p>
        <h1 className="mt-1 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
          Opportunities for verified contributors
        </h1>
        <p className="mt-3 max-w-[62ch] text-muted">
          Holding a ProofMe credential NFT opens this page. ProofMe checks, live on NEAR, that your
          wallet holds an active credential from an organisation it has verified. A revoked or
          replaced credential does not count, and no ProofMe account is needed.
        </p>
      </header>
      <HolderGate />
    </div>
  );
}

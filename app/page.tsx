import { getEnv } from "@/lib/env";

/*
 * Milestone 0 boot page. This is not the landing page: it exists so the
 * project boots and the toolchain can be verified. The designed public
 * website replaces it in Milestone 1.
 */
export default function Home() {
  const env = getEnv();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">ProofMe</h1>
      <p className="mt-2">Your work should speak for itself. We make it verifiable.</p>
      <p className="mt-6 text-sm">
        Project baseline. Environment: {env.APP_ENV}. NEAR network: {env.NEAR_NETWORK}. The product
        interface has not been built yet.
      </p>
    </main>
  );
}

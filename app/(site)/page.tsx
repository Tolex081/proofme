import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SampleCredit } from "@/components/marketing/sample-credit";

const PROVES = [
  "A named organisation approved this exact description of the work.",
  "It did so on the date shown, through a reviewer it authorised.",
  "The record has not been altered since. Change a word and the digest no longer matches.",
  "Whether it still stands: a revoked or replaced record says so, and stays visible.",
];

const DOES_NOT_PROVE = [
  "That every detail of the claim is objectively true.",
  "That the person is skilled at everything, or better than someone else.",
  "That you should trust the organisation. You decide that, knowing who it is.",
];

const MAKING = [
  {
    who: "The contributor",
    what: "describes one piece of work and attaches the evidence.",
    detail:
      "A pull request, a document, a demo. Links are references for a reviewer to judge, not proof in themselves.",
  },
  {
    who: "The organisation’s reviewer",
    what: "approves it, rejects it, or asks for more.",
    detail:
      "Only someone the organisation has authorised can decide, and never the person who made the claim.",
  },
  {
    who: "The organisation’s NEAR account",
    what: "anchors the record’s digest on NEAR testnet.",
    detail:
      "The organisation signs in its own wallet. Only the fingerprint goes on-chain; names and evidence do not.",
  },
  {
    who: "Anyone",
    what: "checks it, without an account.",
    detail:
      "Open the record, recompute the digest, compare it with the one on NEAR, and read who stands behind it.",
  },
];

const WAYS_IN = [
  {
    href: "/for-contributors",
    heading: "Did the work? Keep a record that outlasts the Discord server it happened in.",
    body: "One profile across every project you contribute to, built from records each organisation has confirmed. No wallet needed to start.",
    link: "ProofMe for contributors",
  },
  {
    href: "/for-organisations",
    heading: "Run the project? Put your name to the contributions you can stand behind.",
    body: "Review claims against the evidence, issue attestations from your own NEAR account, and revoke one if it turns out to be wrong.",
    link: "ProofMe for organisations",
  },
] as const;

export default function Home() {
  return (
    <>
      {/* Title card: the promise, one sample credit, and the working check. */}
      <section className="on-ink">
        <div className="column pt-[clamp(1rem,3vh,2.25rem)] pb-[clamp(3rem,8vh,5.5rem)]">
          <div className="credits">
            <h1 className="across text-[clamp(2.2rem,4.3vw,3.3rem)] leading-[1.05] tracking-[-0.022em] md:col-start-2">
              Your work should speak for itself.{" "}
              <span className="text-teal-bright">We make it verifiable.</span>
            </h1>
            <p className="across mt-4 max-w-[64ch] text-[1.05rem] text-on-ink-muted md:col-start-2">
              ProofMe credits a specific piece of work to the person who did it, confirmed by the
              organisation they did it for. Below is a sample record, written for this page. Check
              it yourself.
            </p>
          </div>

          <div className="mt-[clamp(1.5rem,3.5vh,2.25rem)]">
            <SampleCredit />
          </div>

          <div className="credits mt-[clamp(1.5rem,4vh,2.5rem)]">
            <p className="from-axis max-w-[62ch] text-[0.9rem] text-on-ink-muted">
              This record is a sample. The person, organisation and project are fictional, and it is
              not anchored on NEAR. On a real attestation, the recorded digest is read from the NEAR
              testnet registry rather than from this page.
            </p>
          </div>
        </div>
      </section>

      {/* What a credit says, and what it does not. */}
      <section className="on-paper">
        <div className="column py-[clamp(4rem,10vw,7.5rem)]">
          <div className="credits">
            <h2 className="from-axis max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] tracking-[-0.018em]">
              A credit says one thing, precisely.
            </h2>
          </div>

          <div className="credits stack-sm mt-[clamp(2rem,4vw,3.25rem)] gap-y-[clamp(0.25rem,4vw,3rem)]">
            <p className="role sm:pt-[0.5rem]">It proves</p>
            <ul className="max-w-[58ch] space-y-3.5">
              {PROVES.map((line) => (
                <li key={line} className="name text-[clamp(1.1rem,1.6vw,1.35rem)] leading-[1.3]">
                  {line}
                </li>
              ))}
            </ul>

            <p className="role mt-8 sm:mt-0 sm:pt-[0.4rem]">It does not prove</p>
            <ul className="max-w-[58ch] space-y-2.5 text-on-paper-muted">
              {DOES_NOT_PROVE.map((line) => (
                <li key={line} className="text-[1.05rem]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who does what. The role column carries the actor, as credits do. */}
      <section className="on-paper-deep">
        <div className="column py-[clamp(4rem,10vw,7.5rem)]">
          <div className="credits">
            <h2 className="from-axis max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] tracking-[-0.018em]">
              Four parts, each played by someone different.
            </h2>
            <p className="from-axis mt-4 max-w-[60ch] text-on-paper-muted">
              Nobody verifies their own work, and ProofMe never verifies it for them. The person who
              did the work and the organisation that confirms it are always different people.
            </p>
          </div>

          <ol className="mt-[clamp(2rem,4vw,3.25rem)]">
            {MAKING.map((part, index) => (
              <li
                key={part.who}
                className={`credits stack-sm py-[clamp(1.25rem,2.6vw,2rem)] ${index > 0 ? "border-t border-paper-line" : ""}`}
              >
                <p className="role sm:pt-[0.55rem]">{part.who}</p>
                <div>
                  <p className="name max-w-[28ch] text-[clamp(1.3rem,2.2vw,1.8rem)]">{part.what}</p>
                  <p className="mt-2 max-w-[60ch] text-on-paper-muted">{part.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="credits mt-[clamp(1.5rem,3vw,2.5rem)]">
            <p className="from-axis">
              <Link href="/how-it-works" className="text-link inline-flex items-center gap-1.5">
                Read how it works, step by step
                <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Two ways in. */}
      <section className="on-paper">
        <div className="column py-[clamp(4rem,10vw,7.5rem)]">
          <div className="credits gap-y-[clamp(2.75rem,6vw,4.5rem)]">
            {WAYS_IN.map((way) => (
              <div key={way.href} className="from-axis">
                <h2 className="max-w-[26ch] text-[clamp(1.6rem,2.9vw,2.3rem)] leading-[1.12] tracking-[-0.015em]">
                  {way.heading}
                </h2>
                <p className="mt-3 max-w-[60ch] text-on-paper-muted">{way.body}</p>
                <p className="mt-4">
                  <Link href={way.href} className="text-link inline-flex items-center gap-1.5">
                    {way.link}
                    <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
                  </Link>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

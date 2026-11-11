import {
  ArrowRight,
  Check,
  CircleCheck,
  FilePenLine,
  Link2,
  ScanSearch,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import Link from "next/link";

import { SampleCredit } from "@/components/marketing/sample-credit";
import { SampleTimeline } from "@/components/marketing/sample-timeline";

const PROMISES = ["No wallet needed to start", "Private until you share", "No scores, no tokens"];

const STEPS = [
  {
    icon: FilePenLine,
    who: "You",
    title: "Describe one piece of work",
    body: "What you did, for which project, in what role. Attach the pull request, document or demo.",
  },
  {
    icon: UserRoundCheck,
    who: "The organisation",
    title: "Confirms it, or asks for more",
    body: "Only a reviewer they have authorised can decide. Never the person who made the claim.",
  },
  {
    icon: Link2,
    who: "Their NEAR account",
    title: "Anchors the record on testnet",
    body: "Signed in the organisation's own wallet. Only a fingerprint goes on-chain, never your details.",
  },
  {
    icon: ScanSearch,
    who: "Anyone",
    title: "Checks it in seconds",
    body: "Open the record, recompute its fingerprint, compare it with NEAR. No account needed.",
  },
] as const;

const PROVES = [
  "A named organisation approved this exact description of the work",
  "It did so on the date shown, through a reviewer it authorised",
  "The record has not been changed since it was approved",
  "Whether it still stands. Revoked records stay visible, marked as revoked",
];

const DOES_NOT_PROVE = [
  "That every detail of the claim is objectively true",
  "That the person is better than someone else",
  "That you should trust the organisation. That call is yours",
];

export default function Home() {
  return (
    <>
      {/* Hero: the promise, and a sample of what a ProofMe record looks like. */}
      <section className="column grid items-center gap-12 pt-6 pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-12 lg:pb-28">
        <div className="rise">
          <h1 className="text-display leading-[0.98] font-extrabold tracking-[-0.045em]">
            Your work, <span className="marker">confirmed</span> by the people who saw it.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lead text-muted">
            One portable record of what you built across every DAO, protocol and project. Each piece
            is confirmed by the team behind it, so anyone can trust it, and check it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="action action-primary">
              Start your record
            </Link>
            <a href="#check" className="action action-secondary">
              Check a sample record
            </a>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-note text-muted">
            {PROMISES.map((promise) => (
              <li key={promise} className="inline-flex items-center gap-2">
                <CircleCheck
                  aria-hidden="true"
                  size={17}
                  strokeWidth={2.25}
                  className="text-ok-ink"
                />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <div className="rise lg:pl-4">
          <SampleTimeline />
        </div>
      </section>

      {/* The working check. */}
      <section id="check" className="scroll-mt-6 bg-surface-2 py-20 lg:py-28">
        <div className="column grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-10">
            <h2 className="text-heading leading-[1.04]">
              Don&rsquo;t take our word for it. Check it.
            </h2>
            <p className="mt-5 max-w-[30rem] text-lead text-muted">
              Every approved record has a digest: a fingerprint of the whole record, computed with
              SHA-256. Change anything, even one word, and the fingerprint changes completely.
            </p>
            <p className="mt-4 max-w-[30rem] text-lead text-muted">
              On a real record, the digest you compare against is read from the NEAR testnet
              registry, not from ProofMe. This one is a sample, so it lives on this page.
            </p>
          </div>
          <SampleCredit />
        </div>
      </section>

      {/* How a record is made. */}
      <section className="column py-20 lg:py-28">
        <div className="max-w-[40rem]">
          <h2 className="text-heading leading-[1.04]">
            Four steps, each taken by someone different.
          </h2>
          <p className="mt-5 text-lead text-muted">
            Nobody verifies their own work, and ProofMe never verifies it for them.
          </p>
        </div>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-highlight text-highlight-ink">
                  <step.icon aria-hidden="true" size={21} strokeWidth={2} />
                </span>
                <span className="font-display text-note font-bold text-faint">
                  Step {index + 1}
                </span>
              </div>
              <p className="mt-5 text-meta font-semibold text-muted">{step.who}</p>
              <h3 className="mt-1 text-title leading-tight tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-2 text-note text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8">
          <Link href="/how-it-works" className="text-link inline-flex items-center gap-1.5">
            See how it works in detail
            <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
          </Link>
        </p>
      </section>

      {/* What a record proves. */}
      <section className="column pb-20 lg:pb-28">
        <div className="card grid gap-10 p-8 sm:p-10 lg:grid-cols-[0.9fr_1fr_1fr] lg:gap-12 lg:p-12">
          <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-ink">
              <ShieldCheck aria-hidden="true" size={24} strokeWidth={2} />
            </span>
            <h2 className="mt-5 text-subpage leading-[1.08]">Honest about what it proves.</h2>
            <p className="mt-3 text-muted">
              A record is an organisation&rsquo;s word about one piece of work. No more, no less.
            </p>
          </div>
          <div>
            <h3 className="text-lead tracking-[-0.01em]">It proves</h3>
            <ul className="mt-4 grid gap-3">
              {PROVES.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-ok text-ok-ink">
                    <Check aria-hidden="true" size={14} strokeWidth={3} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lead tracking-[-0.01em]">It does not prove</h3>
            <ul className="mt-4 grid gap-3 text-muted">
              {DOES_NOT_PROVE.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-surface-2 text-muted">
                    <X aria-hidden="true" size={14} strokeWidth={3} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Two ways in. */}
      <section className="column grid gap-4 pb-20 md:grid-cols-2 lg:pb-28">
        <div className="card flex flex-col p-8 sm:p-10">
          <h2 className="text-subpage leading-[1.1]">
            Did the work? Keep a record that outlasts the Discord server.
          </h2>
          <p className="mt-4 text-muted">
            One profile across every project you contribute to, built from records each organisation
            has confirmed.
          </p>
          <div className="mt-auto flex flex-wrap gap-3 pt-8">
            <Link href="/register" className="action action-primary">
              Start your record
            </Link>
            <Link href="/for-contributors" className="action action-secondary">
              For contributors
            </Link>
          </div>
        </div>
        <div className="card flex flex-col bg-ink p-8 text-canvas sm:p-10 [&_.text-muted]:text-canvas/75">
          <h2 className="text-subpage leading-[1.1]">
            Run the project? Put your name to the work you stand behind.
          </h2>
          <p className="text-muted mt-4">
            Review claims against the evidence, issue records from your own NEAR account, and revoke
            one if it turns out to be wrong.
          </p>
          <div className="mt-auto pt-8">
            <Link
              href="/for-organisations"
              className="action bg-canvas text-ink hover:bg-brand hover:text-brand-ink"
            >
              For organisations
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

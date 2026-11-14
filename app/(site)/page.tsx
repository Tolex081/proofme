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
import Image from "next/image";
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
    <div className="site-home">
      {/* Hero: the promise, and a sample of what a Atesta record looks like. */}
      <section className="site-hero">
        <Image
          className="site-hero-image"
          src="/images/atesta-workbench.webp"
          alt="A craftsperson concentrating on work at a bench"
          fill
          priority
          sizes="100vw"
        />
        <div className="site-hero-inner column grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="site-hero-copy rise">
            <h1 className="text-display leading-[0.98] font-extrabold tracking-[-0.045em]">
              Your work, <span className="marker">confirmed</span> by the people who saw it.
            </h1>
            <p className="mt-6 text-lead">
              Atesta helps contributors carry credible records of what they built, and lets anyone
              check who approved the work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="action action-primary">
                Start your record
              </Link>
              <a href="#check" className="action action-secondary">
                Check a sample record
              </a>
            </div>
            <ul className="promise-list mt-8 flex flex-wrap gap-x-6 gap-y-2 text-note">
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
          <div className="site-hero-preview rise">
            <SampleTimeline />
          </div>
        </div>
      </section>

      <section className="history-strip column" aria-labelledby="history-title">
        <header className="mb-10 lg:mb-12">
          <h2 id="history-title" className="text-heading leading-[1.04]">
            The tools change. Accountability travels.
          </h2>
          <p className="mt-5 max-w-[42rem] text-lead text-muted">
            A mark once showed who stood behind a piece of work. A signature carried that approval
            forward. Atesta gives approved contributions a portable record that anyone can check.
          </p>
        </header>
        <ol className="grid gap-4 lg:grid-cols-3">
          <li className="history-item card history-item--mark">
            <div className="history-photo">
              <Image
                src="/images/atesta-makers-mark.webp"
                alt="Travel document bearing official entry stamps"
                width={1600}
                height={1067}
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
            </div>
            <div className="history-copy">
              <h3 className="text-title">A mark made its issuer visible.</h3>
              <p className="mt-2 text-note text-muted">
                A visible sign could tell the next person that someone had reviewed and approved.
              </p>
            </div>
          </li>
          <li className="history-item card history-item--signature">
            <div className="history-photo">
              <Image
                src="/images/atesta-signature.webp"
                alt="A person signing a document by hand"
                width={1600}
                height={1067}
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
            </div>
            <div className="history-copy">
              <h3 className="text-title">A signature made it portable.</h3>
              <p className="mt-2 text-note text-muted">
                Approval could travel with the work, attributed to the person who gave it.
              </p>
            </div>
          </li>
          <li className="history-item card">
            <div className="history-product">
              <div className="history-product-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-label uppercase tracking-[0.14em]">Atesta · sample</p>
                    <h3 className="mt-2 font-display text-title font-bold text-white">
                      Contribution record
                    </h3>
                  </div>
                  <span className="status">Organisation approved</span>
                </div>
                <p className="mt-5 text-note">
                  Open the record. Recompute its fingerprint. Check the NEAR testnet entry.
                </p>
                <a
                  href="#check"
                  className="mt-5 inline-flex items-center gap-2 font-semibold text-[#d8f37d] underline underline-offset-4"
                >
                  Try the sample check <ArrowRight aria-hidden="true" size={16} />
                </a>
              </div>
            </div>
            <div className="history-copy">
              <h3 className="text-title">Now anyone can check the record.</h3>
              <p className="mt-2 text-note text-muted">
                Atesta links the approved description to an organisation and a public NEAR testnet
                anchor.
              </p>
            </div>
          </li>
        </ol>
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
              registry, not from Atesta. This one is a sample, so it lives on this page.
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
            Nobody verifies their own work, and Atesta never verifies it for them.
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
    </div>
  );
}

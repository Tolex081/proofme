import { Ban, CircleCheck, CircleDashed, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";

import {
  CreditList,
  NoteSection,
  Notes,
  OnwardLink,
  TitleCard,
} from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a contribution becomes a Atesta attestation: the claim, the review, the NEAR testnet anchor, and how anyone can check it.",
};

const STATES = [
  {
    icon: CircleDashed,
    tone: "chip-neutral",
    name: "Self-reported",
    meaning:
      "The contributor wrote this. No organisation has reviewed it. It is never shown as verified.",
  },
  {
    icon: Clock,
    tone: "chip-wait",
    name: "Awaiting review",
    meaning:
      "Sent to the organisation. Private to the contributor and that organisation’s reviewers.",
  },
  {
    icon: Clock,
    tone: "chip-wait",
    name: "Approved, awaiting NEAR anchor",
    meaning:
      "A reviewer approved it and the record is frozen. No confirmed NEAR transaction exists yet, so it is not shown as anchored.",
  },
  {
    icon: CircleCheck,
    tone: "chip-ok",
    name: "Verified and anchored",
    meaning:
      "A confirmed NEAR testnet transaction from the organisation’s account stores a digest that matches the record.",
  },
  {
    icon: TriangleAlert,
    tone: "chip-bad",
    name: "Anchor failed",
    meaning:
      "The transaction failed or was declined in the wallet. The approval still stands and the organisation can try again.",
  },
  {
    icon: Ban,
    tone: "chip-bad",
    name: "Revoked",
    meaning:
      "The organisation withdrew it and gave a reason. The record stays visible, marked as revoked.",
  },
  {
    icon: RefreshCw,
    tone: "chip-neutral",
    name: "Superseded",
    meaning: "Replaced by a corrected attestation. Both stay visible and link to each other.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <TitleCard title="From a claim to a record anyone can check.">
        A contributor describes one piece of work. The organisation it was done for reviews it. If
        the organisation approves, the record is frozen and its fingerprint is anchored on NEAR
        testnet. Here is each step, and exactly what it does and does not establish.
      </TitleCard>

      <NoteSection
        heading="The contributor makes a claim."
        intro="A claim is a description of one specific contribution, not a job title or a list of skills."
      >
        <CreditList
          ordered
          lines={[
            {
              role: "Describe",
              name: "What you did, for which project, in what role, and when.",
              detail:
                "It can stay a private draft for as long as you like. No wallet is needed for any of this.",
            },
            {
              role: "Attach",
              name: "One or more links to evidence.",
              detail:
                "A pull request, an issue, a document, a demo, a video. Only https links are accepted. Atesta does not open or scan them; a reviewer judges them in context.",
            },
            {
              role: "Submit",
              name: "Send it to the organisation you did the work for.",
              detail:
                "Until an organisation approves it, the claim is yours alone and is labelled self-reported wherever it appears.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection
        deep
        heading="The organisation reviews it."
        intro="Only a person the organisation has given a reviewing role can decide, and the contributor can never review their own claim, whatever role they hold."
      >
        <CreditList
          lines={[
            {
              role: "Approve",
              name: "The organisation stands behind the claim as written.",
              detail:
                "The approved text and evidence links are frozen at that moment. Nobody, including Atesta, can edit them afterwards.",
            },
            {
              role: "Ask",
              name: "The reviewer requests more information.",
              detail:
                "They must say what is missing. The contributor answers, adds evidence if needed, and the claim returns to the queue.",
            },
            {
              role: "Reject",
              name: "The organisation declines, and must say why.",
              detail:
                "The contributor sees the reason. The claim can be reworked and submitted again as a new request.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection
        heading="The organisation anchors it on NEAR."
        intro="Approval and anchoring are two separate facts, and Atesta shows them separately."
      >
        <Notes>
          <p>
            When a claim is approved, Atesta builds a fixed record of it: the claim, the evidence
            links, who issued it, who it is about and when. That record is put into a standard
            canonical form and hashed with SHA-256. The result is the digest, a fingerprint of the
            whole record. A random value inside the record stops anyone reconstructing the digest by
            guessing.
          </p>
          <p>
            The organisation then signs a transaction from its own NEAR account, in its own wallet,
            writing the digest to the Atesta registry contract. Atesta never holds a wallet key and
            cannot sign for an organisation. The record is shown as anchored only after the
            transaction is confirmed and the digest on NEAR matches.
          </p>
          <h3>What goes on NEAR, and what does not</h3>
          <ul>
            <li>
              On NEAR: the attestation&rsquo;s identifier, its digest, the issuing account, and
              whether it has been revoked.
            </li>
            <li>
              Not on NEAR: names, email addresses, the text of the claim, evidence links, reviewer
              notes, or anything else personal.
            </li>
          </ul>
          <p>
            This build uses <strong>NEAR testnet</strong> only. Testnet is a public test network;
            its records carry no real-world value and nothing here runs on mainnet.
          </p>
        </Notes>
      </NoteSection>

      <NoteSection
        deep
        heading="Anyone can check it."
        intro="Checking a record needs no account and no trust in Atesta."
      >
        <CreditList
          ordered
          lines={[
            {
              role: "Open",
              name: "The attestation’s public page.",
              detail:
                "It shows the exact claim that was approved, the evidence, the issuing organisation and the date.",
            },
            {
              role: "Recompute",
              name: "The digest, from the record in front of you.",
              detail: "Your browser does the hashing. The sample on the home page works this way.",
            },
            {
              role: "Compare",
              name: "With the digest stored on NEAR.",
              detail:
                "If they match, the record is the one the organisation anchored. If the registry marks it revoked, the page says so.",
            },
            {
              role: "Decide",
              name: "How much weight to give the issuer.",
              detail:
                "Atesta shows who the organisation is and whether Atesta has reviewed it. Whether to trust its judgement is yours to decide.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection
        heading="What each status means."
        intro="Every status is written in words and carries its own symbol, so none depends on colour."
      >
        <ul className="card divide-y divide-line overflow-hidden">
          {STATES.map((state) => (
            <li
              key={state.name}
              className="grid gap-2 p-5 sm:grid-cols-[15rem_1fr] sm:gap-6 sm:p-6"
            >
              <p>
                <span className={`chip ${state.tone}`}>
                  <state.icon aria-hidden="true" size={14} strokeWidth={2.5} className="shrink-0" />
                  {state.name}
                </span>
              </p>
              <p className="text-muted">{state.meaning}</p>
            </li>
          ))}
        </ul>
      </NoteSection>

      <NoteSection
        deep
        heading="When a record is wrong."
        intro="Nothing is edited after approval. Corrections leave a trail."
      >
        <Notes>
          <p>
            If an organisation finds that an attestation it issued is wrong, it revokes it and gives
            a reason. The revocation is recorded on NEAR from the same issuing account. If the claim
            needs correcting rather than withdrawing, the organisation issues a new attestation that
            supersedes the old one.
          </p>
          <p>
            In both cases the earlier record stays publicly visible with its status shown plainly.
            Revoking an attestation does not erase its history on NEAR, and it is not meant to.
          </p>
          <p>
            Atesta&rsquo;s own administrators can review and suspend organisations. They cannot
            issue, change or revoke an organisation&rsquo;s attestations.
          </p>
        </Notes>
        <OnwardLink href="/">Try the check on the sample record</OnwardLink>
      </NoteSection>
    </>
  );
}

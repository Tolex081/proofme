import type { Metadata } from "next";

import {
  CreditList,
  NoteSection,
  Notes,
  OnwardLink,
  TitleCard,
} from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "For organisations",
  description:
    "Review contribution claims, issue attestations from your own NEAR account, and revoke them when needed.",
};

export default function ForOrganisations() {
  return (
    <>
      <TitleCard title="Give credit you are willing to sign.">
        People already say they contributed to your project. ProofMe lets you say which of those
        claims you stand behind, in your own name, from your own NEAR account, and withdraw one if
        it turns out to be wrong.
      </TitleCard>

      <NoteSection
        heading="What your team does."
        intro="Four roles, each with a defined reach. Every sensitive action is checked on the server against the role of the person doing it."
      >
        <CreditList
          lines={[
            {
              role: "Owner",
              name: "Controls the organisation and its NEAR issuer account.",
              detail:
                "Chooses which NEAR account speaks for the organisation, manages the team, and can transfer ownership. An organisation always keeps at least one owner.",
            },
            {
              role: "Admin",
              name: "Runs projects, the team and the review queue.",
              detail:
                "Can invite reviewers and viewers, manage projects, review claims and revoke attestations.",
            },
            {
              role: "Reviewer",
              name: "Reviews claims and issues attestations.",
              detail:
                "Approves, rejects with a reason, or asks for more information. Can never review their own contribution.",
            },
            {
              role: "Viewer",
              name: "Reads what the organisation has issued.",
              detail:
                "Cannot see pending claims or reviewers’ private notes, and cannot change anything.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection
        deep
        heading="Two kinds of standing, kept apart."
        intro="An organisation can have either, both or neither, and its public page shows each one separately."
      >
        <CreditList
          lines={[
            {
              role: "Reviewed by ProofMe",
              name: "A ProofMe administrator has looked at who you are.",
              detail:
                "New organisations start unverified and are labelled that way. The badge appears only after an administrator approves the application, and the decision is recorded.",
            },
            {
              role: "Registered on NEAR",
              name: "Your NEAR account is an authorised issuer in the registry contract.",
              detail:
                "This is what lets you anchor and revoke attestations. It says nothing about whether ProofMe has reviewed you, and the reverse is true as well.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection heading="What you are taking on.">
        <Notes>
          <p>
            An attestation is your organisation&rsquo;s word. Each one names you as the issuer, is
            anchored from your account, and stays publicly checkable. Approve the claims you can
            actually stand behind, described the way you would describe them.
          </p>
          <p>
            Anchoring and revoking need a NEAR testnet account and a wallet. You approve every
            transaction yourself; ProofMe never asks for a seed phrase or a private key, never
            stores one, and cannot sign on your behalf.
          </p>
          <p>
            ProofMe&rsquo;s administrators can suspend an organisation that abuses the system. They
            cannot issue, edit or revoke attestations in your name.
          </p>
          <p>
            <strong>Where this build stands:</strong> organisation sign-up is not open yet, and
            everything runs on NEAR testnet. Mainnet is not enabled.
          </p>
        </Notes>
        <OnwardLink href="/how-it-works">See the whole process, step by step</OnwardLink>
      </NoteSection>
    </>
  );
}

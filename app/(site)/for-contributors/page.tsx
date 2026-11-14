import type { Metadata } from "next";

import {
  CreditList,
  NoteSection,
  Notes,
  OnwardLink,
  TitleCard,
} from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "For contributors",
  description:
    "Build one record of your contributions across every project, confirmed by the organisations you worked with.",
};

export default function ForContributors() {
  return (
    <>
      <TitleCard title="Your work, credited by the people who saw it.">
        A CV says what you claim. A repository shows what was merged. Neither says that the project
        itself recognises what you did. Atesta is where the organisation says so, in a form that
        someone else can check.
      </TitleCard>

      <NoteSection
        heading="What you can put on record."
        intro="Any contribution an organisation can look at and confirm. Code is one kind among many."
      >
        <CreditList
          lines={[
            {
              role: "Build",
              name: "Development and design.",
              detail:
                "A feature, a fix, an interface, a design system. Point to the pull request or the file.",
            },
            {
              role: "Think",
              name: "Research, writing and documentation.",
              detail: "A report, a specification, a guide, a published analysis.",
            },
            {
              role: "Organise",
              name: "Community, product and project management.",
              detail:
                "Running a programme, moderating a community, shipping a release. The work that rarely leaves a commit behind.",
            },
            {
              role: "Lead",
              name: "Mentorship, governance and hackathon results.",
              detail:
                "Confirmed by the organiser or the body you served, not by a certificate you upload yourself.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection
        deep
        heading="What stays in your hands."
        intro="Your record is yours to shape. The one thing you cannot do is verify it yourself."
      >
        <CreditList
          lines={[
            {
              role: "Private first",
              name: "Drafts and pending claims are never public.",
              detail:
                "Only you, and the reviewers of the organisation you send a claim to, can see it before it is approved.",
            },
            {
              role: "No wallet",
              name: "You do not need a NEAR account to take part.",
              detail:
                "The organisation anchors the attestation from its account. You can link a NEAR account later if you want one shown on your profile.",
            },
            {
              role: "No score",
              name: "Nothing ranks you against anyone else.",
              detail:
                "Your profile shows counts of verified contributions by kind, taken from records that are currently valid. That is all the arithmetic there is.",
            },
            {
              role: "Your profile",
              name: "Public or private, and you choose what to feature.",
              detail:
                "You can hide your profile at any time. Attestations already issued stay checkable by their own link, because the organisation issued them.",
            },
          ]}
        />
      </NoteSection>

      <NoteSection heading="What this cannot do for you.">
        <Notes>
          <p>
            Atesta cannot make an organisation confirm your work, and it will not confirm it in the
            organisation&rsquo;s place. If the project you contributed to is not on Atesta, your
            claim stays self-reported until it is.
          </p>
          <p>
            An attestation is the issuing organisation&rsquo;s word about one piece of work. It is
            only as meaningful as that organisation is to whoever reads it.
          </p>
          <p>
            <strong>Where this build stands:</strong> sign-up is not open yet. The pages you can
            read today describe the product that is being built; the sample record on the home page
            runs the real digest check.
          </p>
        </Notes>
        <OnwardLink href="/how-it-works">See the whole process, step by step</OnwardLink>
      </NoteSection>
    </>
  );
}

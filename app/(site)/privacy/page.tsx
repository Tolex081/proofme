import type { Metadata } from "next";

import { NoteSection, Notes, TitleCard } from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Atesta is designed to handle personal information.",
};

export default function Privacy() {
  return (
    <>
      <TitleCard title="Privacy.">
        This page describes how Atesta is designed to handle information. It is a working draft
        written by the project, not by a lawyer, and it must be reviewed before any public launch.
        It does not claim compliance with any law or certification.
      </TitleCard>

      <NoteSection heading="What the product is designed to keep, and where.">
        <Notes>
          <h3>What this build collects today</h3>
          <p>
            Nothing. Sign-up is not open, the site sets no cookies, and it uses no analytics or
            third-party tracking. The digest check on the home page runs entirely in your browser;
            what you type there is not sent anywhere.
          </p>

          <h3>What accounts will hold</h3>
          <ul>
            <li>Your email address and sign-in details, used only to run your account.</li>
            <li>
              The profile you write: name, username, bio, links and skills. Public only if you make
              your profile public.
            </li>
            <li>
              Your contribution claims and evidence links. Drafts and pending claims are visible
              only to you and to reviewers of the organisation you submit them to.
            </li>
            <li>
              Reviewers&rsquo; private notes, visible only inside the organisation that wrote them.
            </li>
          </ul>

          <h3>What is written to NEAR</h3>
          <p>
            Only an attestation&rsquo;s identifier, its digest, the issuing organisation&rsquo;s
            NEAR account and whether it has been revoked. No name, email address, claim text,
            evidence link or note is written on-chain.
          </p>
          <p>
            A public blockchain cannot be edited. Revoking an attestation marks it as revoked; it
            does not remove the earlier entry.
          </p>

          <h3>Leaving</h3>
          <p>
            Accounts will be able to export their data and request deletion. Attestations an
            organisation has already issued remain checkable in the minimal form needed to keep the
            public record honest, because they are the organisation&rsquo;s statement as well as
            yours. This will be explained again at the point of deletion.
          </p>

          <h3>Before launch</h3>
          <p>
            A data controller, a contact address, retention periods and the legal bases for
            processing are not yet defined. They need a qualified person&rsquo;s review and are
            deliberately not invented here.
          </p>
        </Notes>
      </NoteSection>
    </>
  );
}

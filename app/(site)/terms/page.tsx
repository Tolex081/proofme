import type { Metadata } from "next";

import { NoteSection, Notes, TitleCard } from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "Terms",
  description: "The principles Atesta's terms of use will be built on.",
};

export default function Terms() {
  return (
    <>
      <TitleCard title="Terms.">
        Atesta does not have finished terms of use. What follows are the principles they will be
        built on, written by the project. They are not a contract and need legal review before any
        public launch.
      </TitleCard>

      <NoteSection heading="The ground rules the product is built around.">
        <Notes>
          <h3>What Atesta is</h3>
          <p>
            A place to record contribution claims and the attestations organisations issue about
            them. Atesta is an early build running on NEAR testnet. It is offered as it is, for
            evaluation, with no promise of availability.
          </p>

          <h3>What an attestation is</h3>
          <p>
            A statement by the issuing organisation that it approved a specific claim at a specific
            time. Atesta does not guarantee that any claim is true, and an attestation is not a
            qualification, a reference from Atesta, or advice to rely on anyone.
          </p>

          <h3>What contributors agree to</h3>
          <ul>
            <li>To describe their own work honestly and link only to evidence they may share.</li>
            <li>Not to impersonate anyone or claim another person&rsquo;s work.</li>
          </ul>

          <h3>What organisations agree to</h3>
          <ul>
            <li>To approve only claims they have actually reviewed and can stand behind.</li>
            <li>To let only people they have authorised review on their behalf.</li>
            <li>To revoke or correct an attestation they learn is wrong, and say why.</li>
          </ul>

          <h3>What Atesta may do</h3>
          <p>
            Review, decline or suspend organisations and accounts that mislead or abuse the system,
            and record that it did so. Atesta does not edit or forge an organisation&rsquo;s
            attestations.
          </p>

          <h3>Not for sale</h3>
          <p>
            Attestations, badges and standing cannot be bought. There is no token, and nothing on
            Atesta is a financial product.
          </p>

          <h3>Before launch</h3>
          <p>
            The operating entity, governing law, liability terms and a process for disputes are not
            yet defined and are deliberately not invented here.
          </p>
        </Notes>
      </NoteSection>
    </>
  );
}

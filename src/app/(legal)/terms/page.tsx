import type { Metadata } from "next";
import { APP_URL, CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | FormCraft",
  description:
    "The terms that govern your use of FormCraft, a personal creator intelligence application.",
};

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-on-background">
          Terms of Service
        </h1>
        <p className="text-sm text-secondary">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          1. Who we are
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft (&ldquo;FormCraft&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          is a personal creator intelligence application available at{" "}
          <a
            href={APP_URL}
            className="text-primary underline underline-offset-4"
          >
            {APP_URL}
          </a>
          . It helps a creator organise their own knowledge, connect their own
          social accounts, review their own content performance, research public
          content in their niche, and draft new content ideas.
        </p>
        <p className="leading-relaxed text-secondary">
          By creating an account or using FormCraft, you agree to these Terms. If
          you do not agree, do not use the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          2. Eligibility and accounts
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>You must be at least 13 years old, or the minimum age required in your country, to use FormCraft.</li>
          <li>You are responsible for keeping your login credentials secure and for all activity under your account.</li>
          <li>You must provide accurate information when signing up and keep it current.</li>
          <li>You may not share your account with others or use another person&rsquo;s account without permission.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          3. Connecting social accounts
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft can connect to third-party platforms such as YouTube,
          Instagram, and TikTok using their official APIs and your explicit
          authorisation. When you connect an account:
        </p>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>You authorise FormCraft to read the data covered by the permissions you grant, such as your profile information, your published posts, and their metrics.</li>
          <li>You confirm that you own or are authorised to manage the connected account.</li>
          <li>You remain bound by each platform&rsquo;s own terms of service, and your use of platform data through FormCraft must comply with those terms.</li>
          <li>You may disconnect any account at any time from the Connections page, which stops further data collection for that account.</li>
        </ul>
        <p className="leading-relaxed text-secondary">
          FormCraft does not post to your social accounts on your behalf, and
          does not request posting permissions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          4. Research and public content
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft&rsquo;s research features retrieve publicly available content
          metadata through official platform APIs, approved data providers, or
          links you paste yourself. Results are shown with their source, the
          collection method, and the time the data was retrieved.
        </p>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>FormCraft does not claim ownership of any third-party content shown in research results.</li>
          <li>Metrics and performance comparisons are estimates derived from publicly visible data and may be incomplete or out of date.</li>
          <li>You are responsible for ensuring that content you create after using research features is original and does not infringe anyone&rsquo;s rights.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          5. Your content
        </h2>
        <p className="leading-relaxed text-secondary">
          You keep all rights to the notes, documents, drafts, and other material
          you add to FormCraft. You grant us a limited licence to store and
          process that material solely to operate the service for you, including
          sending relevant excerpts to the AI providers described in our{" "}
          <a href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </a>
          . We do not sell your content and we do not use it to train our own
          models.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          6. AI-generated output
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>FormCraft uses large language models to summarise, analyse, and draft content. Output can be inaccurate, incomplete, or misleading.</li>
          <li>Analyses, outlier explanations, and recommendations are interpretations, not statements of fact or guarantees of performance.</li>
          <li>You are responsible for reviewing, fact-checking, and editing anything you publish.</li>
          <li>FormCraft does not provide legal, financial, medical, or professional advice.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          7. Acceptable use
        </h2>
        <p className="leading-relaxed text-secondary">You agree not to:</p>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>Use FormCraft to break the law or to violate a third-party platform&rsquo;s terms or API policies.</li>
          <li>Scrape, resell, or redistribute data obtained through the service.</li>
          <li>Attempt to access accounts, data, or systems that are not yours.</li>
          <li>Interfere with, overload, or reverse engineer the service.</li>
          <li>Use the service to generate harassing, deceptive, or infringing content.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          8. Availability and changes
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. Features may change, be limited, or be removed,
          and third-party APIs we depend on may change or become unavailable
          without notice. We may suspend or terminate accounts that violate these
          Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          9. Limitation of liability
        </h2>
        <p className="leading-relaxed text-secondary">
          To the maximum extent permitted by law, FormCraft is not liable for
          indirect, incidental, or consequential damages, or for lost profits,
          lost audience growth, or lost data arising from your use of the
          service. Your use of FormCraft and any decisions you make based on its
          output are at your own risk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          10. Termination
        </h2>
        <p className="leading-relaxed text-secondary">
          You may stop using FormCraft and delete your account at any time.
          Deleting your account removes your stored data as described in the
          Privacy Policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          11. Changes to these Terms
        </h2>
        <p className="leading-relaxed text-secondary">
          We may update these Terms as the service evolves. Material changes will
          be reflected by a new &ldquo;last updated&rdquo; date on this page.
          Continuing to use FormCraft after an update means you accept the
          revised Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          12. Contact
        </h2>
        <p className="leading-relaxed text-secondary">
          Questions about these Terms can be sent to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </article>
  );
}

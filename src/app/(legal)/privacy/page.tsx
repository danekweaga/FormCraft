import type { Metadata } from "next";
import { APP_URL, CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | FormCraft",
  description:
    "How FormCraft collects, uses, stores, and deletes your data, including data from connected social accounts.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-on-background">
          Privacy Policy
        </h1>
        <p className="text-sm text-secondary">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          1. Overview
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft is a personal creator intelligence application at{" "}
          <a
            href={APP_URL}
            className="text-primary underline underline-offset-4"
          >
            {APP_URL}
          </a>
          . This policy explains what data we collect, why we collect it, who we
          share it with, and how you can remove it. We collect only what the
          product needs to work for you. We do not sell your data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          2. Data we collect
        </h2>

        <h3 className="font-semibold text-on-background">Account data</h3>
        <p className="leading-relaxed text-secondary">
          Your email address and authentication identifiers, handled by our
          authentication provider. We never see or store your password in plain
          text.
        </p>

        <h3 className="font-semibold text-on-background">
          Content you provide
        </h3>
        <p className="leading-relaxed text-secondary">
          Notes, uploaded documents, strategy and voice guidelines, drafts,
          ideas, experiments, roadmaps, and any URLs or references you save.
        </p>

        <h3 className="font-semibold text-on-background">
          Connected social account data
        </h3>
        <p className="leading-relaxed text-secondary">
          When you connect YouTube, Instagram, or TikTok through their official
          APIs, we store the access tokens needed to keep the connection working
          and the data covered by the permissions you granted, which may include:
        </p>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>Your public profile details, such as username, display name, avatar, and follower count.</li>
          <li>Your published posts and videos, including captions, titles, thumbnails, publish dates, and durations.</li>
          <li>Metrics for those posts, such as views, likes, comments, shares, and saves where the platform provides them.</li>
        </ul>
        <p className="leading-relaxed text-secondary">
          We request read-only access. FormCraft does not post, comment, message,
          or take any other action on your behalf on connected platforms.
        </p>

        <h3 className="font-semibold text-on-background">
          Public research data
        </h3>
        <p className="leading-relaxed text-secondary">
          When you use research features, we store publicly available metadata
          about the posts and creators you discover or track, along with the
          source, the collection method, and the retrieval time. We store this to
          calculate creator-relative performance baselines over time.
        </p>

        <h3 className="font-semibold text-on-background">Usage data</h3>
        <p className="leading-relaxed text-secondary">
          Basic operational records such as AI request counts and costs, external
          data provider usage, error logs, and standard server logs from our
          hosting provider.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          3. How we use data
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>To operate core features: syncing your content, calculating your performance baselines, and surfacing research results.</li>
          <li>To generate analyses, summaries, recommendations, and drafts using AI models.</li>
          <li>To enforce usage limits and budgets so the service stays affordable and predictable.</li>
          <li>To diagnose errors, prevent abuse, and keep the service secure.</li>
        </ul>
        <p className="leading-relaxed text-secondary">
          We do not use your content or connected account data to train our own
          machine learning models, and we do not use it for advertising.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          4. Service providers we share data with
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>
            <span className="font-semibold text-on-background">Supabase</span> —
            database, authentication, and file storage.
          </li>
          <li>
            <span className="font-semibold text-on-background">Vercel</span> —
            application hosting and server logs.
          </li>
          <li>
            <span className="font-semibold text-on-background">
              AI model providers accessed through OpenRouter
            </span>{" "}
            — relevant excerpts of your content and context are sent to generate
            analyses, ideas, and drafts. Only the material needed for a given
            request is sent.
          </li>
          <li>
            <span className="font-semibold text-on-background">
              Platform APIs (YouTube, Instagram, TikTok)
            </span>{" "}
            — we request your data from these platforms using the access you
            authorised.
          </li>
        </ul>
        <p className="leading-relaxed text-secondary">
          We do not sell personal data, and we do not share it with advertisers
          or data brokers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          5. Storage, security, and retention
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>Data is stored in our Supabase project with row-level security so each account can only read its own records.</li>
          <li>Access tokens for connected platforms are stored server-side and are never exposed to the browser.</li>
          <li>Data is transmitted over HTTPS.</li>
          <li>We keep your data while your account is active. When you delete your account or disconnect a platform, the associated data is deleted as described below.</li>
        </ul>
        <p className="leading-relaxed text-secondary">
          No system is perfectly secure. We use reasonable safeguards but cannot
          guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          6. Your choices and rights
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed text-secondary">
          <li>
            <span className="font-semibold text-on-background">
              Disconnect a platform:
            </span>{" "}
            use the Connections page. This revokes FormCraft&rsquo;s stored access
            and stops further syncing. You can also revoke access directly in
            your YouTube, Instagram, or TikTok account settings.
          </li>
          <li>
            <span className="font-semibold text-on-background">
              Delete specific data:
            </span>{" "}
            content, notes, research items, and connections can be deleted from
            within the app.
          </li>
          <li>
            <span className="font-semibold text-on-background">
              Delete your account:
            </span>{" "}
            email us and we will delete your account and associated data.
          </li>
          <li>
            <span className="font-semibold text-on-background">
              Access or export:
            </span>{" "}
            email us for a copy of the data we hold about you.
          </li>
        </ul>
        <p className="leading-relaxed text-secondary">
          Depending on where you live, you may have additional rights under laws
          such as the GDPR or CCPA, including the right to correct or restrict
          processing of your data. Contact us to exercise them.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          7. Data deletion requests
        </h2>
        <p className="leading-relaxed text-secondary">
          To request deletion of your account and all associated data, email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the address on your account with the subject &ldquo;Data
          deletion&rdquo;. We will confirm and complete the deletion within 30
          days, except where we are required to retain limited records by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          8. Children
        </h2>
        <p className="leading-relaxed text-secondary">
          FormCraft is not directed at children under 13, and we do not knowingly
          collect their data. If you believe a child has provided us data, contact
          us and we will delete it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          9. Changes to this policy
        </h2>
        <p className="leading-relaxed text-secondary">
          We may update this policy as the service changes. Updates are reflected
          by a new &ldquo;last updated&rdquo; date on this page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-xl font-semibold text-on-background">
          10. Contact
        </h2>
        <p className="leading-relaxed text-secondary">
          Privacy questions and requests can be sent to{" "}
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

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AppIntegration } from "@/lib/integrations/catalog";

const CATEGORY_LABEL: Record<AppIntegration["category"], string> = {
  research: "Research data",
  ai: "AI & transcripts",
  accounts: "Your connected accounts",
  platform: "App platform",
};

function statusBadge(status: AppIntegration["status"]) {
  if (status === "connected") return <Badge variant="success">Connected</Badge>;
  if (status === "missing") return <Badge variant="danger">Not configured</Badge>;
  return <Badge variant="default">Optional</Badge>;
}

export function IntegrationsPanel({
  integrations,
  scrapeCreators,
}: {
  integrations: AppIntegration[];
  scrapeCreators: {
    remaining: number | null;
    exhausted: boolean;
    warning: string | null;
  };
}) {
  const groups: AppIntegration["category"][] = [
    "research",
    "ai",
    "accounts",
    "platform",
  ];

  return (
    <div className="space-y-8">
      {scrapeCreators.warning ? (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm">
          <p className="font-semibold text-on-background">
            {scrapeCreators.exhausted || scrapeCreators.remaining === 0
              ? "ScrapeCreators credits finished"
              : "ScrapeCreators credits running low"}
          </p>
          <p className="mt-1 text-secondary">{scrapeCreators.warning}</p>
          <p className="mt-2">
            <a
              href="https://app.scrapecreators.com/"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              Buy more credits
            </a>
          </p>
        </div>
      ) : null}

      {groups.map((category) => {
        const items = integrations.filter((i) => i.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-secondary">
              {CATEGORY_LABEL[category]}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-on-background">{item.name}</p>
                    {statusBadge(item.status)}
                  </div>
                  <p className="mt-2 text-sm text-secondary">{item.purpose}</p>
                  <p className="mt-2 text-sm text-on-background">{item.detail}</p>
                  {item.id === "scrapecreators" &&
                  scrapeCreators.remaining != null ? (
                    <p className="mt-2 text-sm font-medium text-on-background">
                      Credits left: {scrapeCreators.remaining}
                      {scrapeCreators.exhausted ? " · finished" : ""} · 1 request
                      = 1 credit
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-secondary">
                    {item.envVars.join(" · ")}
                  </p>
                  {item.docsUrl ? (
                    item.docsUrl.startsWith("/") ? (
                      <Link
                        href={item.docsUrl}
                        className="mt-2 inline-block text-xs text-primary underline"
                      >
                        Open in FormCraft
                      </Link>
                    ) : (
                      <a
                        href={item.docsUrl}
                        className="mt-2 inline-block text-xs text-primary underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Docs
                      </a>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

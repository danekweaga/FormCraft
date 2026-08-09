import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type IntelligenceExplanationProps = {
  title: string;
  recommendation?: string;
  why?: string[];
  evidence?: string[];
  confidence?: "low" | "medium" | "high";
  sources?: string[];
  contradictory?: string[];
  suggestedAction?: string;
  links?: Array<{ label: string; href: string }>;
};

export function IntelligenceExplanation({
  title,
  recommendation,
  why = [],
  evidence = [],
  confidence,
  sources = [],
  contradictory = [],
  suggestedAction,
  links = [],
}: IntelligenceExplanationProps) {
  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{title}</CardTitle>
          {confidence ? (
            <Badge variant="default">Confidence: {confidence}</Badge>
          ) : null}
          {recommendation ? (
            <Badge variant="primary">{recommendation}</Badge>
          ) : null}
        </div>
        {suggestedAction ? (
          <CardDescription>{suggestedAction}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {why.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Why
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {why.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {evidence.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Evidence
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {contradictory.length > 0 ? (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-tertiary">
              Contradictory evidence
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {contradictory.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {sources.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Based on
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {sources.map((source) => (
                <Badge key={source} variant="default">
                  {source}
                </Badge>
              ))}
            </ul>
          </div>
        ) : null}
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-primary underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

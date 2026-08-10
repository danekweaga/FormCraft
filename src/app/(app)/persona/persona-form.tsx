"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCreatorProfile, type CreatorProfileActionState } from "./actions";

const initialState: CreatorProfileActionState = {};

type PersonaValues = {
  what_i_make: string;
  my_audience: string;
  content_style: string;
  script_style: string;
};

const fields: Array<{
  key: keyof PersonaValues;
  title: string;
  badge: string;
  description: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "what_i_make",
    title: "What I make",
    badge: "Research",
    description: "Your niche, recurring topics, expertise, and the transformation your content helps create.",
    placeholder: "I make practical content for... My recurring topics are...",
    rows: 7,
  },
  {
    key: "my_audience",
    title: "My audience",
    badge: "Personalization",
    description: "Who they are, what they already know, what they want, and what usually blocks them.",
    placeholder: "My ideal viewer is... They struggle with... They already understand...",
    rows: 7,
  },
  {
    key: "content_style",
    title: "My content style",
    badge: "Creative direction",
    description: "Tone, formats, pacing, proof standards, boundaries, and anything FormCraft should avoid.",
    placeholder: "Direct and conversational. Prefer... Avoid... Never invent...",
    rows: 10,
  },
  {
    key: "script_style",
    title: "My script style",
    badge: "Scripting",
    description: "Paste a real script or writing sample. Use examples here, not instructions pretending to be a sample.",
    placeholder: "Paste a script that sounds like you...",
    rows: 16,
  },
];

export function PersonaForm({ values }: { values: PersonaValues }) {
  const [state, action, pending] = useActionState(saveCreatorProfile, initialState);

  return (
    <form action={action} className="space-y-5">
      {fields.map((field) => (
        <section
          key={field.key}
          className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-primary paper-shadow"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/15 px-5 py-4">
            <div>
              <h2 className="font-headline text-lg font-semibold text-on-background">{field.title}</h2>
              <p className="mt-1 text-sm text-secondary">{field.description}</p>
            </div>
            <Badge variant="primary">{field.badge}</Badge>
          </div>
          <div className="space-y-2 p-5">
            <Label htmlFor={field.key} className="sr-only">{field.title}</Label>
            <Textarea
              id={field.key}
              name={field.key}
              rows={field.rows}
              defaultValue={values[field.key]}
              placeholder={field.placeholder}
              maxLength={5000}
              required
            />
            <p className="text-right text-xs text-secondary">Maximum 5,000 characters</p>
          </div>
        </section>
      ))}

      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-primary-container">{state.success}</p> : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="paper-shadow">
          {pending ? "Saving profile..." : "Save creator profile"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNicheProfileAction, type ResearchActionState } from "./actions";

const initial: ResearchActionState = {};

export function NicheProfileForm({
  initial: values,
}: {
  initial: {
    mainNiche: string;
    topics: string;
    keywords: string;
    targetAudience: string;
  };
}) {
  const [state, action, pending] = useActionState(
    saveNicheProfileAction,
    initial,
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="mainNiche">Main niche</Label>
        <Input
          id="mainNiche"
          name="mainNiche"
          defaultValue={values.mainNiche}
          placeholder="AI for CS students"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetAudience">Target audience</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          defaultValue={values.targetAudience}
          placeholder="CS students building careers"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="topics">Topics (comma-separated)</Label>
        <Input
          id="topics"
          name="topics"
          defaultValue={values.topics}
          placeholder="internships, vibe coding, portfolios"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="keywords">Keywords</Label>
        <Input
          id="keywords"
          name="keywords"
          defaultValue={values.keywords}
          placeholder="leetcode, openai, hackathon"
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save niche profile"}
        </Button>
        {state.error ? (
          <p className="mt-2 text-sm text-error">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-2 text-sm text-primary-container">{state.success}</p>
        ) : null}
      </div>
    </form>
  );
}

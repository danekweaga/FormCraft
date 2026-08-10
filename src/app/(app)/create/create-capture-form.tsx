"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addEntityToCanvasAction } from "@/app/(app)/canvas/actions";

export function CreateCaptureForm() {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const router = useRouter();

  return (
    <form
      className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
      onSubmit={(e) => {
        e.preventDefault();
        const value = text.trim();
        if (value.length < 8) return;
        start(async () => {
          const fd = new FormData();
          fd.set("nodeType", "script");
          fd.set("title", value.slice(0, 80));
          fd.set("body", value);
          const res = await addEntityToCanvasAction(fd);
          if (res && "boardId" in res && res.boardId) {
            router.push(`/canvas/${res.boardId}`);
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="draft">Script / draft seed</Label>
        <Textarea
          id="draft"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a rough script or outline…"
          required
        />
      </div>
      <Button type="submit" disabled={pending || text.trim().length < 8}>
        {pending ? "Adding…" : "Add script to Canvas"}
      </Button>
    </form>
  );
}

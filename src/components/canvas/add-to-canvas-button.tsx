"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addEntityToCanvasAction } from "@/app/(app)/canvas/actions";
import type { CanvasNodeType } from "@/lib/canvas/types";

export function AddToCanvasButton({
  nodeType,
  title,
  body,
  entityId,
  label = "Add to Canvas",
}: {
  nodeType: CanvasNodeType;
  title: string;
  body?: string | null;
  entityId?: string | null;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("nodeType", nodeType);
          fd.set("title", title);
          if (body) fd.set("body", body);
          if (entityId) fd.set("entityId", entityId);
          const res = await addEntityToCanvasAction(fd);
          if (res && "boardId" in res && res.boardId) {
            router.push(`/canvas/${res.boardId}`);
          }
        })
      }
    >
      {pending ? "Adding…" : label}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateLessonStatus } from "./actions";

export function LessonActions({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="default"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateLessonStatus(lessonId, "confirm");
            router.refresh();
          })
        }
      >
        Confirm
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateLessonStatus(lessonId, "keep_testing");
            router.refresh();
          })
        }
      >
        Keep testing
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateLessonStatus(lessonId, "reject");
            router.refresh();
          })
        }
      >
        Reject
      </Button>
    </div>
  );
}

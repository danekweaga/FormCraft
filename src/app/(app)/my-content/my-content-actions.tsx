"use client";

import { useActionState, useState } from "react";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contentPlatforms } from "@/lib/my-content/schemas";
import { createManualPost, type MyContentActionState } from "./actions";

const initialState: MyContentActionState = {};

export function ManualPostDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createManualPost,
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <MaterialIcon name="add" className="text-base" />
          Add post manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a post manually</DialogTitle>
          <DialogDescription>
            Record a published post and any metrics you have. Leave metrics blank
            when unavailable — FormCraft never invents numbers.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <select
              id="platform"
              name="platform"
              required
              className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
              defaultValue="instagram"
            >
              {contentPlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea id="caption" name="caption" required rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishedAt">Published date</Label>
            <Input id="publishedAt" name="publishedAt" type="date" />
          </div>
          <fieldset className="space-y-3 rounded-lg border border-outline-variant/15 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-primary-container">
              Metrics (optional)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["views", "Views"],
                  ["likes", "Likes"],
                  ["comments", "Comments"],
                  ["shares", "Shares"],
                  ["saves", "Saves"],
                  ["followers_gained", "Followers gained"],
                ] as const
              ).map(([name, label]) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name}>{label}</Label>
                  <Input
                    id={name}
                    name={name}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Unavailable"
                  />
                </div>
              ))}
            </div>
          </fieldset>
          {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save post"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

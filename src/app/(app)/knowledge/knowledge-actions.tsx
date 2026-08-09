"use client";

import { useActionState, useState } from "react";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { importanceLevels, knowledgeTypes } from "@/lib/knowledge/schemas";
import {
  createCollection,
  createNote,
  uploadDocument,
  type KnowledgeActionState,
} from "./actions";

type CollectionOption = {
  id: string;
  name: string;
};

const initialState: KnowledgeActionState = {};

function FormFeedback({ state }: { state: KnowledgeActionState }) {
  if (state.error) {
    return <p className="text-sm text-error">{state.error}</p>;
  }
  if (state.success) {
    return (
      <p className="text-sm text-primary-container">Saved successfully.</p>
    );
  }
  return null;
}

function CollectionSelect({
  collections,
  name = "collectionId",
}: {
  collections: CollectionOption[];
  name?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>Collection</Label>
      <select
        id={name}
        name={name}
        className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary-container"
        defaultValue=""
      >
        <option value="">No collection</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetadataFields({ collections }: { collections: CollectionOption[] }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="knowledgeType">Knowledge type</Label>
        <select
          id="knowledgeType"
          name="knowledgeType"
          className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary-container"
          defaultValue="other"
        >
          {knowledgeTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="importance">Importance</Label>
        <select
          id="importance"
          name="importance"
          className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary-container"
          defaultValue="normal"
        >
          {importanceLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>
      <CollectionSelect collections={collections} />
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          placeholder="Comma-separated, e.g. hooks, voice"
        />
      </div>
      <div className="flex items-center gap-3">
        <input type="hidden" name="includeInAi" value="false" />
        <Switch
          id="includeInAi"
          defaultChecked
          onCheckedChange={(checked) => {
            const hidden = globalThis.document.querySelector<HTMLInputElement>(
              'input[name="includeInAi"]',
            );
            if (hidden) hidden.value = checked ? "true" : "false";
          }}
        />
        <Label htmlFor="includeInAi">Include in AI context</Label>
      </div>
    </>
  );
}

export function CreateCollectionDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCollection,
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MaterialIcon name="create_new_folder" className="text-base" />
          Create collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>
            Group related knowledge so FormCraft can retrieve it with context.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input id="collection-name" name="name" required maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description</Label>
            <Textarea
              id="collection-description"
              name="description"
              rows={3}
              maxLength={2000}
            />
          </div>
          <FormFeedback state={state} />
          {state.success ? (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          ) : (
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create collection"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WriteNoteDialog({
  collections,
}: {
  collections: CollectionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createNote, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MaterialIcon name="edit_note" className="text-base" />
          Write note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Write a note</DialogTitle>
          <DialogDescription>
            Capture strategy, voice, or context as plain text FormCraft can learn
            from.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" name="title" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-description">Description</Label>
            <Textarea id="note-description" name="description" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rawText">Content</Label>
            <Textarea
              id="rawText"
              name="rawText"
              required
              rows={8}
              placeholder="Write your knowledge here…"
            />
          </div>
          <MetadataFields collections={collections} />
          <FormFeedback state={state} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save note"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UploadDocumentDialog({
  collections,
}: {
  collections: CollectionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    uploadDocument,
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <MaterialIcon name="upload_file" className="text-base" />
          Add document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            TXT, Markdown, or PDF up to 10 MB. Text is extracted and chunked for
            retrieval.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" encType="multipart/form-data">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              name="file"
              type="file"
              required
              accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-title">Title</Label>
            <Input
              id="upload-title"
              name="title"
              placeholder="Defaults to filename"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-description">Description</Label>
            <Textarea id="upload-description" name="description" rows={2} />
          </div>
          <MetadataFields collections={collections} />
          <FormFeedback state={state} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Uploading…" : "Upload & process"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgePageActions({
  collections,
}: {
  collections: CollectionOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <UploadDocumentDialog collections={collections} />
      <WriteNoteDialog collections={collections} />
      <CreateCollectionDialog />
    </div>
  );
}

export function ProcessingStatusBadge({
  status,
}: {
  status: string;
}) {
  const variant =
    status === "ready"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "processing"
          ? "warning"
          : "default";

  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}

export function AiInclusionBadge({ included }: { included: boolean }) {
  return included ? (
    <Badge variant="primary">In AI context</Badge>
  ) : (
    <Badge variant="default">Excluded from AI</Badge>
  );
}

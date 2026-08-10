"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { importanceLevels, knowledgeTypes } from "@/lib/knowledge/schemas";
import {
  archiveDocument,
  deleteDocument,
  retryProcessing,
  toggleIncludeInAi,
  updateDocumentMetadata,
  type KnowledgeActionState,
} from "../actions";
import { AiInclusionBadge, ProcessingStatusBadge } from "../knowledge-actions";

type CollectionOption = { id: string; name: string };

type DocumentDetail = {
  id: string;
  title: string;
  description: string | null;
  knowledge_type: string;
  source_type: string;
  processing_status: string;
  processing_error: string | null;
  raw_text: string | null;
  original_filename: string | null;
  mime_type: string | null;
  include_in_ai: boolean;
  is_demo: boolean;
  is_favourite: boolean;
  is_archived: boolean;
  importance: string;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
};

function MetadataForm({
  doc,
  collections,
}: {
  doc: DocumentDetail;
  collections: CollectionOption[];
}) {
  const boundAction = updateDocumentMetadata.bind(null, doc.id);
  const [state, formAction, isPending] = useActionState<
    KnowledgeActionState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={doc.title}
          required
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={doc.description ?? ""}
          rows={2}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="knowledgeType">Knowledge type</Label>
          <select
            id="knowledgeType"
            name="knowledgeType"
            defaultValue={doc.knowledge_type}
            className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
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
            defaultValue={doc.importance}
            className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            {importanceLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="collectionId">Collection</Label>
        <select
          id="collectionId"
          name="collectionId"
          defaultValue={doc.collection_id ?? ""}
          className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
        >
          <option value="">No collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          defaultValue={doc.tags.join(", ")}
          placeholder="Comma-separated"
        />
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <input
            type="hidden"
            name="includeInAi"
            defaultValue={doc.include_in_ai ? "true" : "false"}
          />
          <Switch
            id="includeInAi"
            defaultChecked={doc.include_in_ai}
            onCheckedChange={(checked) => {
              const hidden = globalThis.document.querySelector<HTMLInputElement>(
                'input[name="includeInAi"]',
              );
              if (hidden) hidden.value = checked ? "true" : "false";
            }}
          />
          <Label htmlFor="includeInAi">Include in AI context</Label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="hidden"
            name="isFavourite"
            defaultValue={doc.is_favourite ? "true" : "false"}
          />
          <Switch
            id="isFavourite"
            defaultChecked={doc.is_favourite}
            onCheckedChange={(checked) => {
              const hidden = globalThis.document.querySelector<HTMLInputElement>(
                'input[name="isFavourite"]',
              );
              if (hidden) hidden.value = checked ? "true" : "false";
            }}
          />
          <Label htmlFor="isFavourite">Favourite</Label>
        </div>
      </div>
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-primary-container">Metadata updated.</p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save metadata"}
      </Button>
    </form>
  );
}

function DocumentActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await retryProcessing(documentId);
            router.refresh();
          })
        }
      >
        <MaterialIcon name="refresh" className="text-base" />
        Retry processing
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await archiveDocument(documentId);
            router.push("/knowledge");
          })
        }
      >
        Archive
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (
            !window.confirm(
              "Delete this document permanently? Chunks and files will be removed.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            await deleteDocument(documentId);
            router.push("/knowledge");
          });
        }}
      >
        Delete
      </Button>
    </div>
  );
}

function AiToggle({
  documentId,
  included,
}: {
  documentId: string;
  included: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={included}
        disabled={isPending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            await toggleIncludeInAi(documentId, checked);
            router.refresh();
          })
        }
      />
      <span className="text-sm text-secondary">
        {included ? "Included in AI context" : "Excluded from AI context"}
      </span>
    </div>
  );
}

export function KnowledgeDetailClient({
  document,
  collections,
}: {
  document: DocumentDetail;
  collections: CollectionOption[];
}) {
  return (
    <div>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/knowledge">
            <MaterialIcon name="arrow_back" className="text-base" />
            Back to knowledge
          </Link>
        </Button>
        <PageHeader
          title={document.title}
          description={document.description ?? undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">
            {document.knowledge_type.replace(/_/g, " ")}
          </Badge>
          <Badge variant="default">
            {document.source_type.replace(/_/g, " ")}
          </Badge>
          <ProcessingStatusBadge status={document.processing_status} />
          <AiInclusionBadge included={document.include_in_ai} />
          {document.is_demo ? <Badge variant="demo">Demo</Badge> : null}
          <AddToCanvasButton
            nodeType="knowledge"
            title={document.title}
            body={document.description}
            entityId={document.id}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              Edit how this item is organized and whether FormCraft uses it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetadataForm doc={document} collections={collections} />
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Processing</CardTitle>
            <CardDescription>
              Extraction and chunking status for retrieval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                  Status
                </dt>
                <dd className="mt-1 capitalize text-on-background">
                  {document.processing_status.replace(/_/g, " ")}
                </dd>
              </div>
              {document.original_filename ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                    Original file
                  </dt>
                  <dd className="mt-1 text-on-background">
                    {document.original_filename}
                    {document.mime_type ? ` (${document.mime_type})` : ""}
                  </dd>
                </div>
              ) : null}
              {document.processing_error ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                    Error
                  </dt>
                  <dd className="mt-1 text-error">{document.processing_error}</dd>
                </div>
              ) : null}
            </dl>
            <AiToggle
              documentId={document.id}
              included={document.include_in_ai}
            />
            <DocumentActions documentId={document.id} />
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>Extracted text</CardTitle>
            <CardDescription>
              Plain text stored after extraction or note entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {document.raw_text ? (
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-background">
                {document.raw_text}
              </pre>
            ) : (
              <p className="text-sm text-secondary">
                No extracted text yet. Processing may still be running or failed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

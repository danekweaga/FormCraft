import { z } from "zod";

export const knowledgeTypes = [
  "strategy",
  "brand",
  "voice",
  "research",
  "framework",
  "example",
  "personal_context",
  "product",
  "reference",
  "instruction",
  "other",
] as const;

export const importanceLevels = ["low", "normal", "high", "critical"] as const;

export const allowedKnowledgeMimes = [
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/pdf",
] as const;

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  rawText: z.string().trim().min(1).max(200_000),
  collectionId: z.string().uuid().optional().nullable(),
  knowledgeType: z.enum(knowledgeTypes).default("other"),
  importance: z.enum(importanceLevels).default("normal"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  includeInAi: z.boolean().default(true),
});

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  collectionId: z.string().uuid().optional().nullable(),
  knowledgeType: z.enum(knowledgeTypes),
  importance: z.enum(importanceLevels),
  includeInAi: z.boolean(),
  isFavourite: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

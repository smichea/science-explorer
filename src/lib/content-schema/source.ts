import { z } from 'zod';
import { Id, LocalisedText } from './common';

export const SourceSchema = z.object({
  id: Id,
  kind: z.enum(['primary', 'manuscript', 'translation', 'scholarly', 'tertiary']),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  year: z.string().min(1),
  publication: z.string().optional(),
  place: z.string().optional(),
  url: z.string().url().optional(),
  language: z.string().optional(),
  note: LocalisedText.optional(),
});
export type SourceDefinition = z.infer<typeof SourceSchema>;

/** A quotation record: no narrative line may be displayed as authentic without one. */
export const QuotationSchema = z.object({
  id: Id,
  source: Id,
  originalLanguage: z.string().min(2),
  originalText: z.string().optional(),
  fr: z.string().min(1),
  en: z.string().min(1),
  translationStatus: z.enum(['published_translation', 'authors_translation', 'paraphrase']),
  confidence: z.enum(['high', 'medium', 'low']),
  context: LocalisedText,
});
export type QuotationDefinition = z.infer<typeof QuotationSchema>;

export const SourcesFileSchema = z.object({
  sources: z.array(SourceSchema).default([]),
  quotations: z.array(QuotationSchema).default([]),
});

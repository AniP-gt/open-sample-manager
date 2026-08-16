import { z } from 'zod';
import { searchSamplesInputSchema } from './searchSamplesInput.js';

const sampleIdSchema = z.number().int().safe().positive();
const textFieldSchema = z.string().max(128);
const boundedLimitSchema = z.number().int().min(1).max(100);

export { searchSamplesInputSchema };

const sampleIdsSchema = z.array(sampleIdSchema).min(1).max(100).superRefine((sampleIds, context) => {
  if (new Set(sampleIds).size !== sampleIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'sample_ids must be unique' });
  }
});

export const getSampleInputSchema = z.object({ sample_id: sampleIdSchema }).strict();
export const findSimilarSamplesInputSchema = z.object({
  sample_id: sampleIdSchema,
  limit: boundedLimitSchema,
  exclude_duplicates: z.boolean().default(false),
}).strict();
export const showSamplesInAppInputSchema = z.object({
  sample_ids: sampleIdsSchema,
  selected_id: sampleIdSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.selected_id !== undefined && !value.sample_ids.includes(value.selected_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'selected_id must be one of sample_ids' });
  }
});
export const previewSampleInputSchema = z.object({ sample_id: sampleIdSchema }).strict();
export const addToCollectionInputSchema = z.object({
  collection_name: textFieldSchema,
  sample_ids: sampleIdsSchema,
}).strict();
export const listInstrumentTypesInputSchema = z.object({}).strict();
export const createInstrumentTypeInputSchema = z.object({ name: textFieldSchema.min(1) }).strict();
export const updateSampleInstrumentsInputSchema = z.object({
  assignments: z.array(z.object({
    sample_id: sampleIdSchema,
    instrument_type: textFieldSchema.min(1),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  const ids = value.assignments.map((assignment) => assignment.sample_id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'sample IDs must be unique' });
  }
});
export const listMidisInputSchema = z.object({ directory_path: textFieldSchema.optional(), tag_id: sampleIdSchema.optional(), limit: boundedLimitSchema.optional(), offset: z.number().int().min(0).max(10_000).optional() }).strict();
export const listMidiTagsInputSchema = z.object({}).strict();
export const createMidiTagInputSchema = z.object({ name: textFieldSchema.min(1) }).strict();
export const updateMidiTagsInputSchema = z.object({ assignments: z.array(z.object({ midi_id: sampleIdSchema, tag_id: sampleIdSchema }).strict()).min(1).max(100) }).strict().superRefine((value, context) => {
  const ids = value.assignments.map((assignment) => assignment.midi_id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'MIDI IDs must be unique' });
});

export const operationSchema = z.enum([
  'search_samples',
  'get_sample',
  'find_similar_samples',
  'show_samples_in_app',
  'preview_sample',
  'add_to_collection',
  'list_instrument_types',
  'create_instrument_type',
  'update_sample_instruments',
  'list_midis',
  'list_midi_tags',
  'create_midi_tag',
  'update_midi_tags',
]);
export type Operation = z.infer<typeof operationSchema>;

const nullableNumberSchema = z.number().finite().nullable();
const nullableIntegerSchema = z.number().int().safe().nullable();
const nullableTextSchema = z.string().nullable();

export const sampleSummarySchema = z.object({
  id: sampleIdSchema,
  path: z.string(),
  file_name: z.string(),
  duration: nullableNumberSchema,
  bpm: nullableNumberSchema,
  periodicity: nullableNumberSchema,
  sample_rate: nullableIntegerSchema,
  file_size: nullableIntegerSchema,
  artist: nullableTextSchema,
  low_ratio: nullableNumberSchema,
  attack_slope: nullableNumberSchema,
  decay_time: nullableNumberSchema,
  sample_type: nullableTextSchema,
  source: nullableTextSchema,
  pack_name: nullableTextSchema,
  license: nullableTextSchema,
  license_url: nullableTextSchema,
  license_memo: nullableTextSchema,
  imported_at: nullableTextSchema,
  peak_db: nullableNumberSchema,
  rms_db: nullableNumberSchema,
  leading_silence_ms: nullableNumberSchema,
  clipping_count: nullableIntegerSchema,
  channel_count: nullableIntegerSchema,
  bit_depth: nullableIntegerSchema,
  quality_flags: nullableTextSchema,
  is_online: z.boolean(),
  playback_type: z.string(),
  instrument_type: z.string(),
  musical_key: nullableTextSchema,
  content_hash: nullableTextSchema,
  duplicate_count: z.number().int().safe(),
  tags: z.array(z.string()),
}).strict();

const responseEnvelopeSchema = z.object({
  request_id: z.string().min(1).max(128),
  operation: operationSchema,
}).strict();

export const searchSamplesResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('search_samples'),
  results: z.array(sampleSummarySchema),
  limit: boundedLimitSchema,
  offset: z.number().int().min(0).max(10_000),
  has_more: z.boolean(),
});
export const getSampleResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('get_sample'),
  sample: sampleSummarySchema.nullable(),
});
export const findSimilarSamplesResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('find_similar_samples'),
  source_id: sampleIdSchema,
  matches: z.array(z.object({ sample: sampleSummarySchema, similarity: z.number().finite() }).strict()),
});
export const showSamplesInAppResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('show_samples_in_app'),
  requested_count: z.number().int().min(0).max(100),
  accepted_count: z.number().int().min(0).max(100),
});
export const previewSampleResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('preview_sample'),
  accepted: z.boolean(),
});
export const addToCollectionResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('add_to_collection'),
  collection_name: textFieldSchema,
  requested_count: z.number().int().min(0).max(100),
  added_count: z.number().int().min(0).max(100),
  created: z.boolean(),
});
const instrumentTypeSummarySchema = z.object({
  id: sampleIdSchema,
  name: textFieldSchema,
  created_at: z.string(),
}).strict();
export const listInstrumentTypesResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('list_instrument_types'),
  instrument_types: z.array(instrumentTypeSummarySchema),
});
export const createInstrumentTypeResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('create_instrument_type'),
  instrument_type: instrumentTypeSummarySchema,
});
export const updateSampleInstrumentsResponseSchema = responseEnvelopeSchema.extend({
  operation: z.literal('update_sample_instruments'),
  requested_count: z.number().int().min(1).max(100),
  updated_count: z.number().int().min(0).max(100),
});
const midiSummarySchema = z.object({
  id: sampleIdSchema, path: z.string(), file_name: z.string(), duration: nullableNumberSchema,
  tempo: nullableNumberSchema, time_signature_numerator: z.number().int(), time_signature_denominator: z.number().int(),
  track_count: nullableIntegerSchema, note_count: nullableIntegerSchema, channel_count: nullableIntegerSchema,
  key_estimate: nullableTextSchema, file_size: nullableIntegerSchema, created_at: z.string(), modified_at: z.string(), tag_name: z.string(),
}).strict();
const midiTagSummarySchema = z.object({ id: sampleIdSchema, name: textFieldSchema, created_at: z.string() }).strict();
export const listMidisResponseSchema = responseEnvelopeSchema.extend({ operation: z.literal('list_midis'), results: z.array(midiSummarySchema), limit: boundedLimitSchema, offset: z.number().int().min(0).max(10_000), has_more: z.boolean() });
export const listMidiTagsResponseSchema = responseEnvelopeSchema.extend({ operation: z.literal('list_midi_tags'), tags: z.array(midiTagSummarySchema) });
export const createMidiTagResponseSchema = responseEnvelopeSchema.extend({ operation: z.literal('create_midi_tag'), tag: midiTagSummarySchema });
export const updateMidiTagsResponseSchema = responseEnvelopeSchema.extend({ operation: z.literal('update_midi_tags'), requested_count: z.number().int().min(1).max(100), updated_count: z.number().int().min(0).max(100) });

export const apiErrorSchema = responseEnvelopeSchema.extend({
  code: z.enum([
    'invalid_request',
    'unauthorized',
    'forbidden',
    'not_found',
    'duplicate',
    'payload_too_large',
    'service_unavailable',
    'internal_error',
  ]),
  message: z.string(),
  details: z.string().nullable(),
});

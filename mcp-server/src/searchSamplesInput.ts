import { z } from 'zod';

const textFieldSchema = z.string().max(128);
const querySchema = z.string().max(512);
const boundedLimitSchema = z.number().int().min(1).max(100);

export const searchSamplesInputBaseSchema = z.object({
  query: querySchema.optional(),
  sample_type: textFieldSchema.optional(),
  instrument: textFieldSchema.optional(),
  bpm_min: z.number().finite().min(0).optional(),
  bpm_max: z.number().finite().min(0).optional(),
  key: textFieldSchema.optional(),
  tags: z.array(textFieldSchema).max(100).optional(),
  directory_path: textFieldSchema.optional(),
  limit: boundedLimitSchema.optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.bpm_min !== undefined && value.bpm_max !== undefined && value.bpm_min > value.bpm_max) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'bpm_min must be <= bpm_max' });
  }
});

const isBlankString = (value: string): boolean => value.trim().length === 0;

const normalizeSearchSamplesInput = (input: z.output<typeof searchSamplesInputBaseSchema>) => {
  const hasZeroBpmBounds = input.bpm_min === 0 && input.bpm_max === 0;
  const filteredTags = input.tags?.filter((tag) => !isBlankString(tag));

  return {
    ...(input.query !== undefined && !isBlankString(input.query) ? { query: input.query } : {}),
    ...(input.sample_type !== undefined && !isBlankString(input.sample_type) ? { sample_type: input.sample_type } : {}),
    ...(input.instrument !== undefined && !isBlankString(input.instrument) ? { instrument: input.instrument } : {}),
    ...(!hasZeroBpmBounds && input.bpm_min !== undefined ? { bpm_min: input.bpm_min } : {}),
    ...(!hasZeroBpmBounds && input.bpm_max !== undefined ? { bpm_max: input.bpm_max } : {}),
    ...(input.key !== undefined && !isBlankString(input.key) ? { key: input.key } : {}),
    ...(filteredTags !== undefined && filteredTags.length > 0 ? { tags: filteredTags } : {}),
    ...(input.directory_path !== undefined && !isBlankString(input.directory_path) ? { directory_path: input.directory_path } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.offset !== undefined ? { offset: input.offset } : {}),
  };
};

export const searchSamplesInputSchema = searchSamplesInputBaseSchema.transform(normalizeSearchSamplesInput);

export type SearchSamplesInput = z.input<typeof searchSamplesInputSchema>;
export type SearchSamplesNormalizedInput = z.output<typeof searchSamplesInputSchema>;

import { z } from 'zod';
import {
  ExtractionCompletenessSchema,
  GenerationSchema,
  MAX_POST_CHARACTERS,
  VersionSchema,
} from './primitives';

// Local identity never belongs in ClassificationInput sent to a provider.
export const PostIdentitySchema = z.strictObject({
  postId: z.string().min(1).max(256),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  nodeGeneration: GenerationSchema,
});
export const ExtractedPostSchema = z.strictObject({
  identity: PostIdentitySchema,
  text: z.string().max(MAX_POST_CHARACTERS),
  extraction: ExtractionCompletenessSchema,
  extractorVersion: VersionSchema,
  localSponsored: z.boolean(),
});

export type PostIdentity = z.infer<typeof PostIdentitySchema>;
export type ExtractedPost = z.infer<typeof ExtractedPostSchema>;

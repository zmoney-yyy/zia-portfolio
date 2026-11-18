import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The six display-only cards on Home. The MDX body is reserved for the later
// case-study phase; in v1 only the frontmatter is used.
const projects = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/projects' }),
  schema: z.object({
    order: z.number().int(),
    num: z.string(),
    tint: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    title: z.string(),
    blurb: z.string(),
    role: z.string(),
    tagline: z.string(),
    metric: z.string(),
  }),
});

export const collections = { projects };

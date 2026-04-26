import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    time: z.string(),
    location: z.string(),
    description: z.string(),
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/board' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    order: z.number(),
    bio: z.string(),
    email: z.string().optional(),
    headshot: z.string().optional(),
  }),
});

export const collections = { events, board };

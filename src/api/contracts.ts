import { z } from 'zod';

export const PAGE_SIZE = 5;

export const endReasonSchema = z.enum(['timeUp', 'defeated']);

export const matchConfigSchema = z.object({
  sessionSeconds: z.number(),
  spawnSeconds: z.number(),
});

export const matchRecordSchema = z.object({
  matchId: z.string().min(1),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  finishedAt: z.string().min(1),
  score: z.number().int().min(0),
  durationSeconds: z.number().min(0),
  endReason: endReasonSchema,
  config: matchConfigSchema,
});

export const rankingEntrySchema = matchRecordSchema.extend({
  rank: z.number().int().min(1),
});

const pageFields = {
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
};

export const rankingPageSchema = z.object({ items: z.array(rankingEntrySchema), ...pageFields });
export const historyPageSchema = z.object({ items: z.array(matchRecordSchema), ...pageFields });

export type EndReason = z.infer<typeof endReasonSchema>;
export type MatchConfig = z.infer<typeof matchConfigSchema>;
export type MatchRecord = z.infer<typeof matchRecordSchema>;
export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type RankingPage = z.infer<typeof rankingPageSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;

export const END_REASON_LABELS: Readonly<Record<EndReason, string>> = {
  timeUp: 'Time is up',
  defeated: 'Ship destroyed',
};

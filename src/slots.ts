/** Ordered slots must match delimiter-split segments from one streamed completion. */
export const STREAM_SLOTS = ['hero', 'details', 'tasting', 'cta'] as const;
export type StreamSlotId = (typeof STREAM_SLOTS)[number];

/** Sentinel that must appear between slot fragments only (exact substring match). */
export const SLOT_DELIMITER = '<<<SLOT_END>>>';

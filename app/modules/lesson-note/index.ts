import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the Lesson page's note box should show for the text the Student has
 * typed, given the body of their saved Note (null when there is none yet):
 * the character count, whether it is over the limit, whether it differs from
 * what is saved, and whether Save should be enabled.
 */
export function noteDraft(draft: string, savedBody: string | null): NoteDraft {
  return describeDraft(draft, savedBody);
}

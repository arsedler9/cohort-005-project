import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * Lets the note box disable Save before the Student posts something the
 * server would reject, using the same trim and limit as saveNote.
 */
export function noteDraft(draft: string, savedBody: string | null): NoteDraft {
  return describeDraft(draft, savedBody);
}

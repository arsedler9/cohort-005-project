import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  /** Characters that would be saved: the server trims before it counts. */
  length: number;
  max: number;
  tooLong: boolean;
  /** The box holds something other than the saved Note. */
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = length === 0;
  // Saved Notes are stored trimmed (saveNote), so only the draft needs it.
  const unsaved = trimmed !== (savedBody ?? "");

  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}

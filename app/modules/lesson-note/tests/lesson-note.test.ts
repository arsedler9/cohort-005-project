import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteDraft", () => {
  it("cannot save an empty box when there is no Note yet", () => {
    expect(noteDraft("", null)).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      tooLong: false,
      unsaved: false,
      canSave: false,
    });
  });

  it("treats whitespace only as empty", () => {
    const draft = noteDraft("   \n\t ", null);
    expect(draft.length).toBe(0);
    expect(draft.canSave).toBe(false);
  });

  it("can save new text when there is no Note yet", () => {
    const draft = noteDraft("Offset is simpler", null);
    expect(draft.length).toBe(17);
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("counts what will be saved, not the surrounding whitespace", () => {
    expect(noteDraft("  abc  ", null).length).toBe(3);
  });

  it("has nothing to save when the box matches the saved Note", () => {
    const draft = noteDraft("Cursor pagination", "Cursor pagination");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("ignores whitespace-only edits to the saved Note", () => {
    expect(noteDraft("Cursor pagination \n", "Cursor pagination").unsaved).toBe(
      false
    );
  });

  it("can save an edit to the saved Note", () => {
    const draft = noteDraft("Cursor pagination is stable", "Cursor pagination");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a box cleared of its saved Note", () => {
    const draft = noteDraft("", "Cursor pagination");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("allows exactly the limit", () => {
    const draft = noteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save one character over the limit", () => {
    const draft = noteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(draft.tooLong).toBe(true);
    expect(draft.length).toBe(MAX_NOTE_LENGTH + 1);
    expect(draft.canSave).toBe(false);
  });
});

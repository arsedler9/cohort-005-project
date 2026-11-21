import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { noteDraft, type NoteDraft } from "~/modules/lesson-note";

// Styled to match the Questions & Discussion card further down the page, so
// the two read as one family of lesson tools.
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const draft = noteDraft(body, note?.body ?? null);

  return (
    <Card className="mb-8 gap-0 py-0">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="resize-y"
          />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus
              error={error}
              draft={draft}
              updatedAt={note?.updatedAt}
            />
            <CharacterCount draft={draft} />
          </div>

          <PrivacyHint />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteStatus({
  error,
  draft,
  updatedAt,
}: {
  error: string | undefined;
  draft: NoteDraft;
  updatedAt: string | undefined;
}) {
  if (error) return <span className="text-sm text-destructive">{error}</span>;
  if (draft.tooLong) {
    return (
      <span className="text-sm text-destructive">
        Note must be {draft.max} characters or fewer
      </span>
    );
  }
  if (draft.unsaved && updatedAt) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!updatedAt) return null;
  return (
    <span suppressHydrationWarning className="text-xs text-muted-foreground">
      Saved {formatRelativeTime(updatedAt)}
    </span>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Lock className="size-3" />
        Private
      </span>
    </div>
  );
}

function PrivacyHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Only you can see your notes. Find them all on your{" "}
      <Link to="/saved" className="underline hover:text-foreground">
        Saved
      </Link>{" "}
      page.
    </p>
  );
}

function CharacterCount({ draft }: { draft: NoteDraft }) {
  return (
    <span
      className={cn(
        "ml-auto text-xs",
        draft.tooLong ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {draft.length} / {draft.max}
    </span>
  );
}

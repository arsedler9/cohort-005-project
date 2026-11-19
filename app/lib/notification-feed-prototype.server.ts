// PROTOTYPE, throwaway. For "What does the Notification Feed look like in Cadence?" (#26).
// Lives only on the prototype/notification-feed branch. Never merge.
//
// Sends catalogue Notifications to the *current* DevUI user, so you can fill your
// own feed and look at it. Real Knock Development workflows; real names, courses
// and lessons from the DB; the actor is a random other user.
import { ne, eq, isNull, and } from "drizzle-orm";
import { db } from "~/db";
import { users, courses, lessons, modules, comments } from "~/db/schema";
import { knock } from "~/lib/knock-prototype.server";

export const SAMPLE_KINDS = [
  "discussion-reply",
  "discussion-question",
  "refund-approved",
  "refund-declined",
  "refund-request-opened",
  "seat-claimed",
  "new-enrollment",
] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

async function identify(u: { id: number; name: string; email: string; avatarUrl: string | null }) {
  await knock.users.update(String(u.id), {
    name: u.name,
    email: u.email,
    avatar: u.avatarUrl ?? undefined,
  });
}

export async function sendSampleToMe(meId: number, kind: SampleKind) {
  const me = db.select().from(users).where(eq(users.id, meId)).get()!;
  const actor = pick(db.select().from(users).where(ne(users.id, meId)).all());
  const lesson = pick(
    db
      .select({
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .all()
  );
  const comment =
    db
      .select({ id: comments.id, body: comments.body })
      .from(comments)
      .where(and(eq(comments.lessonId, lesson.lessonId), isNull(comments.deletedAt)))
      .get() ?? { id: 0, body: "Could you explain the second example again? I got lost at the part about closures." };

  await identify(me);
  await identify(actor);

  const base = {
    actor_name: actor.name,
    actor_avatar: actor.avatarUrl,
    course_title: lesson.courseTitle,
    lesson_title: lesson.lessonTitle,
  };
  const lessonUrl = `/courses/${lesson.courseSlug}/lessons/${lesson.lessonId}#comment-${comment.id}`;
  const snippet = comment.body.slice(0, 140);

  const t = (workflow: string, data: Record<string, unknown>) =>
    knock.workflows.trigger(workflow, {
      recipients: [String(me.id)],
      actor: String(actor.id),
      data: { ...base, kind, ...data },
    });

  switch (kind) {
    case "discussion-reply":
      return t("discussion-reply", { replier_name: actor.name, snippet, url: lessonUrl });
    case "discussion-question":
      return t("discussion-question", { asker_name: actor.name, snippet, url: lessonUrl });
    case "refund-approved":
      return t("refund-request-decided", {
        decision: "approved",
        decision_note: "Refunded in full. Sorry the course wasn't a fit.",
        url: `/courses/${lesson.courseSlug}`,
      });
    case "refund-declined":
      return t("refund-request-decided", {
        decision: "declined",
        decision_note: "You've completed most of the course, which is past our refund window. You can ask again if something changes.",
        url: `/courses/${lesson.courseSlug}`,
      });
    case "refund-request-opened":
      return t("refund-request-opened", {
        buyer_name: actor.name,
        amount: "$49.00",
        reason: "The course is aimed at a more advanced level than I expected.",
        url: `/admin/refunds`,
      });
    case "seat-claimed":
      return t("seat-claimed", {
        claimer_name: actor.name,
        seats_left: Math.floor(Math.random() * 8),
        url: `/team`,
      });
    case "new-enrollment":
      return t("new-enrollment", {
        student_name: actor.name,
        url: `/instructor/${lesson.courseId}/students`,
      });
  }
}

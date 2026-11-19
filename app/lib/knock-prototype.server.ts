// PROTOTYPE, throwaway. Spike for "Does Knock hold up against Cadence?" (#28).
// Lives only on the prototype/knock-spike branch. Never merge.
import Knock, { signUserToken } from "@knocklabs/node";
import { eq, isNull, and, desc } from "drizzle-orm";
import { db } from "~/db";
import { users, comments, lessons, modules, courses } from "~/db/schema";

// Vite doesn't put non-VITE_ vars from .env into process.env on the server.
try {
  process.loadEnvFile();
} catch {}

export const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });

export function knockPublicConfig() {
  return {
    publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
    channelId: process.env.KNOCK_FEED_CHANNEL_ID!,
  };
}

// Knock user ids are strings. We use the Cadence user id as-is.
export async function identifyAndSign(userId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  await knock.users.update(String(user.id), {
    name: user.name,
    email: user.email,
  });
  const token = await signUserToken(String(user.id), {
    expiresInSeconds: 60 * 60,
  });
  return { user, token };
}

// Real Discussion Questions: top-level, not deleted, authored by someone other
// than the course's Instructor.
export function listDiscussionQuestions() {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      lessonId: comments.lessonId,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      authorId: comments.userId,
      authorName: users.name,
      instructorId: courses.instructorId,
    })
    .from(comments)
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt))
    .limit(20)
    .all()
    .filter((q) => q.authorId !== q.instructorId);
}

export function listCourses() {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      instructorId: courses.instructorId,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .all();
}

async function ensureIdentified(userId: number) {
  const u = db.select().from(users).where(eq(users.id, userId)).get()!;
  await knock.users.update(String(u.id), { name: u.name, email: u.email });
  return u;
}

// Discussion Reply → question author. The actor is whoever the DevUI selects.
export async function triggerDiscussionReply(actorId: number, questionId: number) {
  const q = listDiscussionQuestions().find((x) => x.id === questionId);
  if (!q) throw new Error("Discussion Question not found");
  const actor = await ensureIdentified(actorId);
  await ensureIdentified(q.authorId);
  return knock.workflows.trigger("discussion-reply", {
    recipients: [String(q.authorId)],
    actor: String(actor.id),
    data: {
      replier_name: actor.name,
      course_title: q.courseTitle,
      lesson_title: q.lessonTitle,
      question_excerpt: q.body.slice(0, 120),
      url: `/courses/${q.courseSlug}/lessons/${q.lessonId}#comment-${q.id}`,
    },
  });
}

// New Enrollment → Instructor. Off by default; the Instructor must opt in.
export async function triggerNewEnrollment(actorId: number, courseId: number) {
  const c = listCourses().find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found");
  const actor = await ensureIdentified(actorId);
  await ensureIdentified(c.instructorId);
  return knock.workflows.trigger("new-enrollment", {
    recipients: [String(c.instructorId)],
    actor: String(actor.id),
    data: {
      student_name: actor.name,
      course_title: c.title,
      url: `/instructor/${c.id}/students`,
    },
  });
}

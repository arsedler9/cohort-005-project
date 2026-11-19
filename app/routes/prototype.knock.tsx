// PROTOTYPE, throwaway. Spike for "Does Knock hold up against Cadence?" (#28).
// Raw and ugly on purpose: it checks vendor fit, not how the Feed looks.
import { useEffect, useRef, useState } from "react";
import { data, useFetcher } from "react-router";
import type { Route } from "./+types/prototype.knock";
import { getCurrentUserId } from "~/lib/session";
import {
  identifyAndSign,
  knockPublicConfig,
  listCourses,
  listDiscussionQuestions,
  triggerDiscussionReply,
  triggerNewEnrollment,
} from "~/lib/knock-prototype.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel", { status: 401 });
  const { user, token } = await identifyAndSign(userId);
  return {
    user: { id: user.id, name: user.name, role: user.role },
    token,
    ...knockPublicConfig(),
    questions: listDiscussionQuestions(),
    courses: listCourses(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel", { status: 401 });
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "discussion-reply") {
      const res = await triggerDiscussionReply(userId, Number(form.get("questionId")));
      return { ok: true, intent, res };
    }
    if (intent === "new-enrollment") {
      const res = await triggerNewEnrollment(userId, Number(form.get("courseId")));
      return { ok: true, intent, res };
    }
  } catch (e) {
    return { ok: false, intent, error: String(e) };
  }
  return { ok: false, intent, error: "unknown intent" };
}

type Log = { at: string; what: string; detail?: unknown };

export default function KnockPrototype({ loaderData }: Route.ComponentProps) {
  const { user, token, publicKey, channelId, questions, courses } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [feedState, setFeedState] = useState<any>(null);
  const [prefs, setPrefs] = useState<any>(null);
  const [log, setLog] = useState<Log[]>([]);
  const feedRef = useRef<any>(null);
  const knockRef = useRef<any>(null);

  const push = (what: string, detail?: unknown) =>
    setLog((l) => [{ at: new Date().toLocaleTimeString(), what, detail }, ...l].slice(0, 30));

  // Check 1: the browser authenticates the headless client with our signed token.
  // Re-runs whenever the DevUI switches user (new user.id + token).
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { default: Knock } = await import("@knocklabs/client");
      if (cancelled) return;
      const knock = new Knock(publicKey);
      knock.authenticate(String(user.id), token);
      knockRef.current = knock;
      const feed = knock.feeds.initialize(channelId, { page_size: 20 });
      feedRef.current = feed;
      unsub = feed.store.subscribe((s: any) => setFeedState({ ...s }));
      feed.listenForUpdates();
      try {
        await feed.fetch();
        push(`feed.fetch() ok as user ${user.id}`);
      } catch (e) {
        push("feed.fetch() FAILED", String(e));
      }
      try {
        setPrefs(await knock.user.getPreferences());
      } catch (e) {
        push("getPreferences FAILED", String(e));
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
      feedRef.current?.dispose?.();
      knockRef.current?.teardown?.();
    };
  }, [user.id, token, publicKey, channelId]);

  useEffect(() => {
    if (fetcher.data) push(`trigger ${fetcher.data.intent}`, fetcher.data);
  }, [fetcher.data]);

  const items: any[] = feedState?.items ?? [];
  const meta = feedState?.metadata;

  async function act(name: string, fn: () => Promise<unknown>) {
    try {
      const r = await fn();
      push(name, r);
    } catch (e) {
      push(`${name} FAILED`, String(e));
    }
  }

  async function setEnrollmentOptIn(on: boolean) {
    await act(`setPreferences new-enrollment=${on}`, async () => {
      const current = (await knockRef.current.user.getPreferences()) ?? {};
      const next = await knockRef.current.user.setPreferences({
        workflows: current.workflows ?? {},
        channel_types: current.channel_types ?? {},
        channels: current.channels ?? {},
        categories: { ...(current.categories ?? {}), "new-enrollment": on },
      });
      setPrefs(next);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 font-mono text-xs">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 text-amber-900">
        PROTOTYPE: Knock spike for #28. Throwaway. Switch users in the DevUI and watch the feed follow.
      </div>

      <section>
        <h2 className="font-bold text-sm">1. Signed user token</h2>
        <div>Cadence user: {user.id} {user.name} ({user.role})</div>
        <div className="break-all text-muted-foreground">token: {token.slice(0, 60)}…</div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-sm">2. Trigger (Node SDK, actor = current user)</h2>
        <fetcher.Form method="post" className="flex gap-2 items-center">
          <input type="hidden" name="intent" value="discussion-reply" />
          <select name="questionId" className="border p-1 max-w-xl">
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                Q#{q.id} by {q.authorName} (user {q.authorId}) on {q.lessonTitle}: {q.body.slice(0, 40)}
              </option>
            ))}
          </select>
          <button className="border px-2 py-1 bg-muted">Reply → notify question author</button>
        </fetcher.Form>
        <fetcher.Form method="post" className="flex gap-2 items-center">
          <input type="hidden" name="intent" value="new-enrollment" />
          <select name="courseId" className="border p-1 max-w-xl">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} (Instructor {c.instructorName}, user {c.instructorId})
              </option>
            ))}
          </select>
          <button className="border px-2 py-1 bg-muted">Enroll → notify Instructor</button>
        </fetcher.Form>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-sm">3. Headless feed (@knocklabs/client)</h2>
        <div>
          status: {feedState?.networkStatus} · total: {meta?.total_count} · unread: {meta?.unread_count} · unseen:{" "}
          {meta?.unseen_count}
        </div>
        <div className="flex gap-2">
          <button className="border px-2 py-1" onClick={() => act("fetch", () => feedRef.current.fetch())}>
            refetch
          </button>
          <button className="border px-2 py-1" onClick={() => act("markAllAsSeen", () => feedRef.current.markAllAsSeen())}>
            mark all seen
          </button>
          <button className="border px-2 py-1" onClick={() => act("markAllAsRead", () => feedRef.current.markAllAsRead())}>
            mark all read
          </button>
        </div>
        <table className="w-full border">
          <thead>
            <tr className="text-left bg-muted">
              <th className="p-1">workflow</th>
              <th className="p-1">blocks</th>
              <th className="p-1">data</th>
              <th className="p-1">seen</th>
              <th className="p-1">read</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t align-top">
                <td className="p-1">{i.source?.key}</td>
                <td className="p-1">{i.blocks?.map((b: any) => b.rendered ?? b.content).join(" | ")}</td>
                <td className="p-1 max-w-sm break-all">{JSON.stringify(i.data)}</td>
                <td className="p-1">{i.seen_at ? "✓" : ""}</td>
                <td className="p-1">{i.read_at ? "✓" : ""}</td>
                <td className="p-1 whitespace-nowrap">
                  <button className="border px-1" onClick={() => act("markAsSeen", () => feedRef.current.markAsSeen(i))}>
                    seen
                  </button>{" "}
                  <button className="border px-1" onClick={() => act("markAsRead", () => feedRef.current.markAsRead(i))}>
                    read
                  </button>{" "}
                  <button className="border px-1" onClick={() => act("markAsUnread", () => feedRef.current.markAsUnread(i))}>
                    unread
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-sm">4. Preferences (this user's default set)</h2>
        <div className="flex gap-2">
          <button className="border px-2 py-1" onClick={() => setEnrollmentOptIn(true)}>
            opt IN to new-enrollment
          </button>
          <button className="border px-2 py-1" onClick={() => setEnrollmentOptIn(false)}>
            opt OUT of new-enrollment
          </button>
          <button
            className="border px-2 py-1"
            onClick={() => act("getPreferences", async () => { const p = await knockRef.current.user.getPreferences(); setPrefs(p); return p; })}
          >
            reload
          </button>
        </div>
        <pre className="bg-muted p-2 overflow-auto">{JSON.stringify(prefs, null, 2)}</pre>
      </section>

      <section>
        <h2 className="font-bold text-sm">Log</h2>
        <pre className="bg-muted p-2 overflow-auto max-h-96">
          {log.map((l) => `${l.at} ${l.what}${l.detail ? " " + JSON.stringify(l.detail) : ""}`).join("\n")}
        </pre>
      </section>
    </div>
  );
}

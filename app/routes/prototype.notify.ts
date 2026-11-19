// PROTOTYPE, throwaway (#26). POST { kind } sends a sample catalogue Notification to the current user.
import { data } from "react-router";
import type { Route } from "./+types/prototype.notify";
import { getCurrentUserId } from "~/lib/session";
import { sendSampleToMe, SAMPLE_KINDS, type SampleKind } from "~/lib/notification-feed-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel", { status: 401 });
  const form = await request.formData();
  const kinds = String(form.get("kind")) === "all" ? [...SAMPLE_KINDS] : [String(form.get("kind")) as SampleKind];
  try {
    for (const k of kinds) await sendSampleToMe(userId, k);
    return { ok: true, sent: kinds };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

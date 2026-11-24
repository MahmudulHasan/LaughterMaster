"use server";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { isAdmin } from "@/server/auth/admin";
import { REPORT_REASONS } from "@/server/db/schema";
import { getReadyDb } from "@/server/db/ready";
import { removeJokeAsAdmin } from "@/server/jokes/queries";

import { banUser, reportJoke, restoreJoke, type ReportError } from "./queries";

async function currentUserId(): Promise<string | null> {
  await connection();
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Every admin action re-checks rights on the server (never from the client). */
async function requireAdmin(): Promise<string> {
  const userId = await currentUserId();
  if (!userId || !isAdmin(userId)) redirect("/");
  return userId;
}

const jokeIdSchema = z.string().min(1).max(200);

export type ReportFormState =
  | { ok: true; hidden: boolean }
  | { ok: false; error: ReportError | "invalid" }
  | null;

/** A member reports a joke (US-15); for `useActionState`. */
export async function reportJokeAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const parsed = z
    .object({ jokeId: jokeIdSchema, reason: z.enum(REPORT_REASONS) })
    .safeParse({
      jokeId: formData.get("jokeId"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "not_signed_in" };
  const db = await getReadyDb();
  return reportJoke(db, { ...parsed.data, userId });
}

/** Admin: publish a hidden or pending joke (US-16). */
export async function restoreJokeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const jokeId = jokeIdSchema.safeParse(formData.get("jokeId"));
  if (jokeId.success) {
    await restoreJoke(await getReadyDb(), { jokeId: jokeId.data });
  }
  redirect("/admin");
}

/** Admin: remove a joke from the queue (US-16). */
export async function removeJokeFromQueueAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const jokeId = jokeIdSchema.safeParse(formData.get("jokeId"));
  if (jokeId.success) {
    await removeJokeAsAdmin(await getReadyDb(), { jokeId: jokeId.data });
  }
  redirect("/admin");
}

/** Admin: ban a member (US-16). Admins can't be banned from the app. */
export async function banUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = jokeIdSchema.safeParse(formData.get("userId"));
  if (userId.success && !isAdmin(userId.data)) {
    await banUser(await getReadyDb(), userId.data);
  }
  redirect("/admin");
}

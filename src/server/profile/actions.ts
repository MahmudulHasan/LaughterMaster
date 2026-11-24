"use server";

import { connection } from "next/server";

import { auth, unstable_update } from "@/auth";
import { getReadyDb } from "@/server/db/ready";
import { getModerator } from "@/server/moderation/shared";
import {
  setDisplayName,
  validateDisplayName,
  type DisplayNameError,
} from "@/server/users";

export type DisplayNameFormState =
  | { ok: true; name: string }
  | {
      ok: false;
      error: DisplayNameError | "not_signed_in" | "rejected" | "try_later";
      /** For "rejected": the moderator's short reason. */
      reason?: string;
    }
  | null;

/**
 * Change the signed-in member's display name (US-3): validate, check it with
 * Claude like a joke (fail closed: if Claude is unavailable the old name
 * stays), save it, then refresh the session so the header shows it at once.
 */
export async function updateDisplayNameAction(
  _prev: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "not_signed_in" };

  const raw = formData.get("name");
  const valid = validateDisplayName(typeof raw === "string" ? raw : "");
  if (!valid.ok) return { ok: false, error: valid.error };

  const check = await getModerator().moderateDisplayName(valid.name);
  if (check.kind === "unavailable") return { ok: false, error: "try_later" };
  if (!check.allowed) {
    return { ok: false, error: "rejected", reason: check.reason };
  }

  const db = await getReadyDb();
  const member = await setDisplayName(db, userId, valid.name);
  if (!member) return { ok: false, error: "not_signed_in" };
  // Re-issues the session cookie; the jwt callback re-reads the name.
  await unstable_update({});
  return { ok: true, name: member.displayName };
}

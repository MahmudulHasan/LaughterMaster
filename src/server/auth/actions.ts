"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

import {
  DEV_PROVIDER_ID,
  isDevSignInEnabled,
  isGoogleConfigured,
} from "./providers";
import { safeRedirectPath, withSignInFailed } from "./safe-redirect";

function redirectToFrom(formData: FormData): string {
  return safeRedirectPath(formData.get("redirectTo"));
}

/** Start Google sign-in; returns to `redirectTo` (same-site path) after. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const redirectTo = redirectToFrom(formData);
  if (!isGoogleConfigured()) redirect(withSignInFailed(redirectTo));
  try {
    await signIn("google", { redirectTo });
  } catch (error) {
    // signIn() redirects by throwing; only Auth.js errors are failures.
    if (error instanceof AuthError) redirect(withSignInFailed(redirectTo));
    throw error;
  }
}

/** Dev-only test sign-in (D15). Unknown ids or production fail closed. */
export async function signInAsDevUser(formData: FormData): Promise<void> {
  const redirectTo = redirectToFrom(formData);
  const userId = formData.get("userId");
  if (!isDevSignInEnabled()) redirect(withSignInFailed(redirectTo));
  try {
    await signIn(DEV_PROVIDER_ID, {
      userId: typeof userId === "string" ? userId : "",
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) redirect(withSignInFailed(redirectTo));
    throw error;
  }
}

/** Sign out and return to `redirectTo` (same-site path) or "/". */
export async function signOutAction(formData: FormData): Promise<void> {
  await signOut({ redirectTo: redirectToFrom(formData) });
}

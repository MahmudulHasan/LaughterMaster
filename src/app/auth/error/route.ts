import type { NextRequest } from "next/server";

import { signInFailedRedirectPath } from "@/server/auth/safe-redirect";

// Auth.js sends failed or cancelled sign-ins here (pages.error). US-1 wants
// the visitor back on the page they started from, still logged out, with
// "Sign-in didn't finish. Try again." The header shows that message when the
// URL has `signin=failed`, so this route only redirects. It is also
// pages.signIn, so Auth.js's built-in sign-in page is never shown (our dialog
// replaces it); a visit there without an error just goes back.
export function GET(request: NextRequest): Response {
  const path = signInFailedRedirectPath({
    callbackUrl: request.nextUrl.searchParams.get("callbackUrl"),
    error: request.nextUrl.searchParams.get("error"),
    getCookie: (name) => request.cookies.get(name)?.value,
  });
  return Response.redirect(new URL(path, request.nextUrl.origin), 303);
}

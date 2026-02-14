/**
 * Next.js Middleware
 * Refreshes auth session on every request and protects routes.
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession, isProtectedPath } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Update the session - this refreshes auth tokens
  const { supabaseResponse, user } = await updateSession(request);

  // Check if route requires authentication
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

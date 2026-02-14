/**
 * Supabase Middleware Helper
 * Refreshes auth session on every request.
 *
 * This is critical - without updateSession(), auth tokens won't refresh
 * and API calls will fail with 401 errors.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your app
  // vulnerable to security issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}

/**
 * Check if path requires authentication
 */
export function isProtectedPath(pathname: string): boolean {
  const protectedPaths = ["/notes", "/settings"];
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Check if path is public (no auth required)
 */
export function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/callback",
    "/auth/forgot-password",
    "/auth/reset-password",
  ];
  return publicPaths.includes(pathname);
}

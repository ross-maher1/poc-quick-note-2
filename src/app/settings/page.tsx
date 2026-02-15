"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

/**
 * Settings page with sign out functionality.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
      await Promise.race([signOutPromise, timeoutPromise]);
    } catch {
      // Redirect regardless of error
    } finally {
      window.location.href = "/auth/login";
    }
  };

  return (
    <main className="space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <p className="type-meta">Preferences</p>
        <h1 className="type-h1">Settings</h1>
        <p className="type-lead">Manage your account.</p>
      </div>

      {/* Account */}
      {user && (
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm max-w-lg">
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>

          <div className="mt-6">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-slate-200 disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}

      {/* About */}
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm max-w-lg">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 text-sm text-slate-600">
          {APP_NAME} is built with Next.js, TypeScript, and Tailwind CSS.
        </p>
      </div>
    </main>
  );
}

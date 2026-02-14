"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/notes";
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    setLoading(true);

    const { error } = await signIn({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            {...register("email")}
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Password</label>
          <input
            {...register("password")}
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-rose-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Forgot password?
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-slate-900 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="space-y-10">
      <div className="space-y-2">
        <p className="type-meta">Authentication</p>
        <h1 className="type-h1">Sign In</h1>
        <p className="type-lead">Sign in to your account to continue.</p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm max-w-md">
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}

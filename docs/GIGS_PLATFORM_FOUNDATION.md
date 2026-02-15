# Gigs Platform Foundation Setup Guide

**Purpose:** This document provides the complete setup instructions for implementing the shared Gigs authentication and database system in any micro app. Follow this guide when creating a new app or integrating an existing app into the Gigs platform.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Supabase Project Setup](#part-1-supabase-project-setup)
4. [Part 2: Database Schema Setup](#part-2-database-schema-setup)
5. [Part 3: Application Integration](#part-3-application-integration)
6. [Part 4: Environment Configuration](#part-4-environment-configuration)
7. [Part 5: Testing & Verification](#part-5-testing--verification)

---

## Overview

### What This System Provides

The Gigs platform uses a single Supabase project shared across all micro apps. This enables:

- **Single Sign-On:** Users authenticate once and can access all apps (Invoice Generator, Set List Generator, etc.)
- **Shared User Data:** User profiles, subscription status, and preferences are consistent across apps
- **Unlimited Usage:** All users can create unlimited invoices, set lists, acts, and venues
- **Zero-Friction Upgrades:** When users upgrade to Premium, additional features become available across all apps

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Project                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Auth Service │  │  Database   │  │   Row Level Security │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                │                    │
           ▼                ▼                    ▼
    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │ Invoice  │     │ Set List │        │  Future  │
    │Generator │     │Generator │        │   Apps   │
    └──────────┘     └──────────┘        └──────────┘
```

### Subscription Tiers

| Tier    | Features                                                            |
| ------- | ------------------------------------------------------------------- |
| Free    | Unlimited invoices, set lists, contacts, PDF export                 |
| Premium | All free features + cross-app integration, analytics, priority support |

---

## Prerequisites

Before starting, ensure you have:

- [ ] A Supabase account (free tier is sufficient for development)
- [ ] Node.js 18+ installed
- [ ] A Next.js 14+ project (App Router)
- [ ] The `@supabase/ssr` package installed

```bash
npm install @supabase/ssr @supabase/supabase-js
```

---

## Part 1: Supabase Project Setup

### 1.1 Create the Supabase Project

> **Note:** If a Gigs Supabase project already exists, skip to Part 2 and use the existing project credentials.

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Configure:
   - **Name:** `gigs-platform`
   - **Database Password:** Generate and save securely
   - **Region:** Choose closest to your users (e.g., `ap-southeast-2` for Australia)
4. Click **Create new project**
5. Wait ~2 minutes for provisioning

### 1.2 Retrieve API Credentials

1. Go to **Settings → API**
2. Copy and save these values:

| Key                  | Description                  | Security                  |
| -------------------- | ---------------------------- | ------------------------- |
| Project URL          | `https://xxxxx.supabase.co`  | Public                    |
| anon public key      | `eyJ...`                     | Public (safe for browser) |
| service_role secret  | `eyJ...`                     | **SECRET** (server-only)  |

### 1.3 Configure Authentication Settings

1. Go to **Authentication → URL Configuration**

2. Set **Site URL** to your production URL:
   ```
   https://invoices.gigs.app
   ```

3. Add **Redirect URLs** for all environments:
   ```
   http://localhost:3000/**
   http://localhost:3001/**
   https://invoices.gigs.app/**
   https://setlists.gigs.app/**
   https://app.gigs.app/**
   ```

4. Go to **Authentication → Settings**

5. Configure email settings:
   - **Enable email confirmations:** ON for production, OFF for development
   - **Secure email change:** ON

---

## Part 2: Database Schema Setup

### 2.1 Run Migrations

Execute these SQL scripts in order in the Supabase SQL Editor (**SQL Editor → New Query**):

#### Migration 1: Schema

```sql
-- ============================================================================
-- MIGRATION 1: INITIAL SCHEMA
-- Creates all tables for the Gigs platform
-- ============================================================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email TEXT NOT NULL,
    full_name TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    preferences JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';

-- 2. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT,
    business_name TEXT,
    address TEXT,
    phone TEXT,
    notes TEXT
);

-- 3. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invoice_number TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_business_name TEXT,
    client_address TEXT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    business_details JSONB
);

-- 4. SET LISTS TABLE
CREATE TABLE IF NOT EXISTS public.set_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    event_date DATE,
    venue_name TEXT,
    act_name TEXT,
    songs JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_duration INTEGER,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);

-- 5. ACTS TABLE (future use)
CREATE TABLE IF NOT EXISTS public.acts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    members JSONB DEFAULT '[]'::jsonb,
    default_set_list_id UUID REFERENCES public.set_lists(id) ON DELETE SET NULL
);

-- 6. VENUES TABLE (future use)
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    address TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    capacity INTEGER,
    notes TEXT
);

-- 7. NOTES TABLE
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notes IS 'Quick notes created by users';
```

#### Migration 2: Row Level Security

```sql
-- ============================================================================
-- MIGRATION 2: ROW LEVEL SECURITY
-- Ensures users can only access their own data
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- CONTACTS POLICIES
CREATE POLICY "contacts_select_own" ON public.contacts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert_own" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_update_own" ON public.contacts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_delete_own" ON public.contacts
    FOR DELETE USING (auth.uid() = user_id);

-- INVOICES POLICIES
CREATE POLICY "invoices_select_own" ON public.invoices
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON public.invoices
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON public.invoices
    FOR DELETE USING (auth.uid() = user_id);

-- SET LISTS POLICIES
CREATE POLICY "set_lists_select_own" ON public.set_lists
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "set_lists_insert_own" ON public.set_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "set_lists_update_own" ON public.set_lists
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "set_lists_delete_own" ON public.set_lists
    FOR DELETE USING (auth.uid() = user_id);

-- ACTS POLICIES
CREATE POLICY "acts_select_own" ON public.acts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acts_insert_own" ON public.acts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acts_update_own" ON public.acts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acts_delete_own" ON public.acts
    FOR DELETE USING (auth.uid() = user_id);

-- VENUES POLICIES
CREATE POLICY "venues_select_own" ON public.venues
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "venues_insert_own" ON public.venues
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "venues_update_own" ON public.venues
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "venues_delete_own" ON public.venues
    FOR DELETE USING (auth.uid() = user_id);

-- NOTES POLICIES
CREATE POLICY "notes_select_own" ON public.notes
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "notes_insert_own" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "notes_delete_own" ON public.notes
    FOR DELETE USING (auth.uid() = owner_id);
```

#### Migration 3: Indexes

```sql
-- ============================================================================
-- MIGRATION 3: INDEXES
-- Performance optimization for common queries
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id_name ON public.contacts(user_id, name);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_status ON public.invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_issue_date ON public.invoices(user_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON public.invoices(contact_id);

-- Set lists indexes
CREATE INDEX IF NOT EXISTS idx_set_lists_user_id ON public.set_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_set_lists_event_date ON public.set_lists(event_date);
CREATE INDEX IF NOT EXISTS idx_set_lists_user_id_event_date ON public.set_lists(user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_set_lists_user_id_is_template ON public.set_lists(user_id, is_template);

-- Acts indexes
CREATE INDEX IF NOT EXISTS idx_acts_user_id ON public.acts(user_id);

-- Venues indexes
CREATE INDEX IF NOT EXISTS idx_venues_user_id ON public.venues(user_id);

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON public.notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notes_owner_id_created_at ON public.notes(owner_id, created_at DESC);
```

#### Migration 4: Triggers & Functions

```sql
-- ============================================================================
-- MIGRATION 4: TRIGGERS & FUNCTIONS
-- Automated behaviors for the platform
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_contacts BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_set_lists BEFORE UPDATE ON public.set_lists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_acts BEFORE UPDATE ON public.acts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_venues BEFORE UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2.2 Verify Setup

After running all migrations, verify in Supabase Dashboard:

1. **Table Editor:** You should see 7 tables:
   - `profiles`, `contacts`, `invoices`, `set_lists`, `acts`, `venues`, `notes`

2. **Database → Triggers:** You should see:
   - `on_auth_user_created`
   - `set_updated_at_*` (one per table)

3. **Authentication → Policies:** Each table should have its RLS policies

---

## Part 3: Application Integration

### 3.1 Install Dependencies

```bash
npm install @supabase/ssr @supabase/supabase-js
```

### 3.2 Create Supabase Client Files

#### Browser Client (`src/lib/supabase/client.ts`)

```typescript
/**
 * Supabase Browser Client
 * Use in client components ('use client')
 */
import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
```

#### Server Client (`src/lib/supabase/server.ts`)

```typescript
/**
 * Supabase Server Client
 * Use in Server Components, API routes, Server Actions
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore in Server Components
        }
      },
    },
  });
}
```

#### Middleware (`src/middleware.ts`)

```typescript
/**
 * Next.js Middleware
 * Refreshes auth session on every request
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/invoices', '/contacts', '/settings', '/set-lists'];
  const isProtected = protectedPaths.some(
    path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### 3.3 Create Auth Context

Create `src/contexts/AuthContext.tsx`:

```typescript
'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: 'free' | 'premium';
  onboarding_completed: boolean;
  preferences: Record<string, unknown> | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (credentials: { email: string; password: string }) => Promise<{ error: AuthError | null }>;
  signUp: (credentials: { email: string; password: string; fullName?: string }) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data as Profile | null;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setProfile(profile);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    if (!supabase) return { error: new Error('Not initialized') as AuthError };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [supabase]);

  const signUp = useCallback(async ({ email, password, fullName }: { email: string; password: string; fullName?: string }) => {
    if (!supabase) return { error: new Error('Not initialized') as AuthError };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error('Not initialized') as AuthError };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 3.4 Create Auth Hook

Create `src/hooks/useAuth.ts`:

```typescript
'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 3.5 Wrap App in AuthProvider

Update `src/app/layout.tsx`:

```typescript
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 3.6 Create Auth Pages

Create these pages in `src/app/auth/`:

- `login/page.tsx` - Sign in form
- `signup/page.tsx` - Registration form
- `forgot-password/page.tsx` - Password reset request
- `reset-password/page.tsx` - New password form
- `callback/route.ts` - OAuth callback handler

**Example callback handler (`src/app/auth/callback/route.ts`):**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate`);
}
```

---

## Part 4: Environment Configuration

### 4.1 Local Development

Create `.env.local`:

```bash
# Public - safe for browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# Server-only - NEVER expose to browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```

### 4.2 Production (Vercel)

Add environment variables in **Vercel Dashboard → Settings → Environment Variables**:

| Variable                       | Value                        | Environment      |
| ------------------------------ | ---------------------------- | ---------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | `https://xxx.supabase.co`    | All              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| `eyJ...`                     | All              |
| `SUPABASE_SERVICE_ROLE_KEY`    | `eyJ...`                     | Production only  |

### 4.3 Add to `.gitignore`

```
.env.local
.env*.local
```

---

## Part 5: Testing & Verification

### 5.1 Auth Flow Test

1. Start the dev server: `npm run dev`
2. Navigate to `/auth/signup`
3. Create a test account
4. Check **Supabase Dashboard → Table Editor → profiles**
5. Verify a profile was auto-created

### 5.2 RLS Test

1. Sign in as User A
2. Create a contact or invoice
3. Sign out
4. Sign in as User B
5. Verify User B cannot see User A's data

### 5.3 Cross-App Auth Test (if multiple apps exist)

1. Sign in on App A (e.g., Invoice Generator)
2. Navigate to App B (e.g., Set List Generator)
3. Verify you're already authenticated

---

## Quick Reference

### Common Issues

| Issue                            | Solution                                         |
| -------------------------------- | ------------------------------------------------ |
| "permission denied"              | Check RLS policies are created                   |
| Profile not created              | Check `on_auth_user_created` trigger exists      |
| Session not persisting           | Verify middleware is configured                  |
| "Missing environment variables"  | Check `.env.local` exists and has correct values |

---

## Changelog

| Version | Date    | Changes                                              |
| ------- | ------- | ---------------------------------------------------- |
| 1.0     | 2024-01 | Initial foundation setup                             |
| 1.1     | 2024-01 | Removed usage limits - all users have unlimited access |

---

*This document is the authoritative source for Gigs platform database and authentication setup. Keep it updated as the platform evolves.*

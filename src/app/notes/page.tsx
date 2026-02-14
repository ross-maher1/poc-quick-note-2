import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Note } from "@/lib/types";
import NotesClient from "./NotesClient";

/**
 * Notes page - Server Component
 * Fetches initial notes from Supabase and handles auth redirect
 */
export default async function NotesPage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/notes");
  }

  // Fetch notes from Supabase (20 max, newest first)
  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching notes:", error);
  }

  return <NotesClient initialNotes={(notes as Note[]) || []} userId={user.id} />;
}

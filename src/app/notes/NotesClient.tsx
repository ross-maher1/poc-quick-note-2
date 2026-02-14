"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";

import { Note } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Form validation schema
 */
const noteSchema = z.object({
  content: z
    .string()
    .min(1, "Note content is required")
    .max(1000, "Note must be 1000 characters or less"),
});

type NoteFormValues = z.infer<typeof noteSchema>;

type NotesClientProps = {
  initialNotes: Note[];
  userId: string;
};

/**
 * Notes Client Component
 * Handles create and delete operations via Supabase
 */
export default function NotesClient({ initialNotes, userId }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      content: "",
    },
  });

  // Save a new note to Supabase
  const onSubmit = async (values: NoteFormValues) => {
    setSaving(true);
    setError(null);

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const { data, error: insertError } = await supabase
        .from("notes")
        .insert({
          owner_id: userId,
          content: values.content,
        })
        .select()
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw insertError;
      }

      // Add to list (newest first), enforce 20 max
      setNotes((prev) => [data as Note, ...prev].slice(0, 20));
      reset();
    } catch (err: unknown) {
      console.error("Error saving note:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (errorMessage.includes("aborted")) {
        setError("Request timed out. Please check your connection.");
      } else {
        setError(`Failed to save note: ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete a note from Supabase
  const deleteNote = async (id: string) => {
    setDeleting(id);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setNotes((prev) => prev.filter((note) => note.id !== id));
    } catch (err) {
      console.error("Error deleting note:", err);
      setError("Failed to delete note. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <main className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="type-meta">Quick Notes</p>
          <h1 className="type-h1">Notes</h1>
          <p className="type-lead">Capture your thoughts quickly.</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">New Note</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                What&apos;s on your mind?
              </label>
              <textarea
                {...register("content")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="Type your note here..."
                rows={5}
                disabled={saving}
              />
              {errors.content && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.content.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Note"}
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Notes</h2>
            <span className="text-xs text-slate-500">
              {notes.length} / 20 max
            </span>
          </div>
          {notes.length === 0 ? (
            <p className="mt-4 type-lead">
              No notes yet. Add one to get started.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-grow space-y-1">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(note.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNote(note.id)}
                      disabled={deleting === note.id}
                      className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"
                      aria-label="Delete note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

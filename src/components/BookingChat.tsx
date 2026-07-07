"use client";

// Booking-scoped chat between guest and owner, on Supabase Realtime.

import { useCallback, useEffect, useRef, useState } from "react";
import { hasSupabaseClient, supabaseBrowser } from "@/lib/supabase/client";

interface Message {
  id: string;
  body: string;
  from_admin: boolean;
  created_at: string;
}

interface Props {
  bookingId: string;
  asAdmin: boolean;
  userId: string;
}

export default function BookingChat({ bookingId, asAdmin, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("messages")
      .select("id, body, from_admin, created_at")
      .eq("booking_id", bookingId)
      .order("created_at");
    if (data) setMessages(data);
  }, [bookingId]);

  useEffect(() => {
    if (!hasSupabaseClient()) return;
    load();
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_id: userId,
      from_admin: asAdmin,
      body,
    });
    if (err) {
      setError("Message failed to send — please try again.");
    } else {
      setDraft("");
      // Realtime will append it; notify the other side by email too.
      fetch("/api/messages/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, fromAdmin: asAdmin, preview: body }),
      }).catch(() => {});
      load();
    }
    setSending(false);
  }

  if (!hasSupabaseClient()) {
    return <p className="text-sm text-stone-500">Messaging will be available once the site is fully configured.</p>;
  }

  return (
    <div className="flex h-96 flex-col rounded-xl border border-stone-200 bg-white">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-stone-400">
            No messages yet — say hello!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.from_admin === asAdmin;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-moss text-white" : "bg-stone-100 text-stone-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-stone-400"}`}>
                  {new Date(m.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-4 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2 border-t border-stone-200 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="flex-1 resize-none rounded border border-stone-300 px-3 py-2 text-sm focus:border-moss focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="rounded-full bg-moss px-5 text-sm font-semibold text-white hover:bg-moss-dark disabled:bg-stone-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}

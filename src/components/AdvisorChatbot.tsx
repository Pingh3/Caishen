"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Where should I allocate new money this month?",
  "Am I above my 70% stocks/funds cap?",
  "How do I reach 50% SG within stocks/funds?",
];

const WELCOME: Message = {
  role: "assistant",
  content:
    "Ask about your allocations. I use your latest snapshot and targets to suggest what to trim, hold, or top up. Educational guidance only.",
};

export function AdvisorChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, loading]);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        setError(json.error ?? "Could not get a response.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.reply! },
      ]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open ? (
        <div
          className="flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-lg sm:w-96"
          role="dialog"
          aria-label="Allocation advisor chat"
        >
          <header className="flex items-center justify-between border-b border-surface-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-primary">Allocation advisor</p>
              <p className="text-[10px] text-muted">Powered by Groq</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-primary"
              aria-label="Close chat"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto p-3"
          >
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "ml-4 border border-accent/30 bg-accent/10 text-primary"
                    : "mr-2 border border-surface-border bg-surface text-secondary"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {loading ? (
              <p className="text-xs text-muted">Thinking…</p>
            ) : null}
          </div>

          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-1 border-t border-surface-border px-3 py-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="rounded-full border border-surface-border px-2 py-1 text-[10px] text-secondary hover:text-primary disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="border-t border-surface-border p-2"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about allocation…"
              className="w-full resize-none text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e);
                }
              }}
            />
            {error ? (
              <p className="mt-1 text-[10px] text-negative">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="mt-1.5 w-full rounded-lg bg-accent py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-accent text-white shadow-lg transition hover:bg-accent-muted ${
          open ? "ring-2 ring-accent/40" : ""
        }`}
        aria-label={open ? "Close allocation advisor" : "Open allocation advisor"}
        aria-expanded={open}
      >
        {open ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <ChatIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

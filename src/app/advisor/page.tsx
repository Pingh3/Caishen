"use client";

import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Given my current breakdown, where should I allocate new money this month?",
  "Am I above my 70% stocks/funds cap? If yes, by how much?",
  "How can I move toward 50% SG share within stocks/funds over 3 months?",
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask me about your allocations. I will use your latest data and your targets (stocks/funds cap and SG share) to suggest what to trim, hold, or top up.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply! }]);
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Allocation advisor</h2>
        <p className="mt-1 text-sm text-secondary">
          Groq chat using your latest snapshot, holdings, and most-liquid allocation
          targets. Educational guidance only.
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Try asking</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="rounded-full border border-surface-border px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-surface-border bg-surface-raised p-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-8 border border-accent/30 bg-accent/10 text-primary"
                : "mr-8 border border-surface-border bg-surface text-secondary"
            }`}
          >
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">
              {m.role === "user" ? "You" : "Advisor"}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {loading ? (
          <p className="text-sm text-muted">Thinking…</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I have SGD 5,000 new cash this month. Where should I deploy it?"
          className="w-full resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Tip: include monthly contribution amount and risk comfort.
          </p>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Sending…" : "Ask advisor"}
          </button>
        </div>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
      </form>
    </div>
  );
}

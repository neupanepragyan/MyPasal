"use client";

import { useState, useTransition } from "react";
import { ask } from "@/app/actions";

const SUGGESTIONS = [
  "What should I reorder this week?",
  "What should I stop stocking?",
  "What new products could I add?",
];

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(q: string) {
    setQuestion(q);
    setError(null);
    startTransition(async () => {
      const result = await ask(q);
      if (result.ok) setAnswer(result.answer);
      else setError(result.error);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl bg-emerald-50 p-4">
      <h2 className="font-semibold text-emerald-900">Ask Gemma</h2>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={pending}
            className="rounded-full bg-white px-3 py-1.5 text-sm text-emerald-800 shadow-sm disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your shop"
          aria-label="Question"
          maxLength={500}
          className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-3"
        />
        <button
          disabled={pending || !question.trim()}
          className="h-11 shrink-0 rounded-xl bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      {pending && <p className="text-sm text-emerald-800">Thinking…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {answer && !pending && <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-relaxed">{answer}</p>}
    </section>
  );
}

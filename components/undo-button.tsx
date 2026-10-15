"use client";

import { useTransition } from "react";
import { undoEntry } from "@/app/actions";

export function UndoButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (confirm("Undo this entry? Its stock changes will be removed.")) {
          startTransition(() => undoEntry(id));
        }
      }}
      disabled={pending}
      className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Undoing…" : "Undo"}
    </button>
  );
}

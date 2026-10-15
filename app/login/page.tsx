"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center px-4">
      <h1 className="text-3xl font-bold tracking-tight text-emerald-700">Pasal</h1>
      <p className="mt-1 text-stone-500">Enter your shop PIN.</p>
      <form action={action} className="mt-6 space-y-3">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          aria-label="PIN"
          className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg tracking-widest"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Open"}
        </button>
      </form>
    </main>
  );
}

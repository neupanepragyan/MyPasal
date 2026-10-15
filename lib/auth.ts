import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "pasal_session";

function env(name: "APP_PIN" | "SESSION_SECRET", min: number) {
  const value = process.env[name];
  if (!value || value.length < min) {
    throw new Error(`${name} must be set and at least ${min} characters`);
  }
  return value;
}

function hmac(value: string) {
  return createHmac("sha256", env("SESSION_SECRET", 32)).update(value).digest();
}

// Derived from the PIN, so changing APP_PIN logs every device out.
export function sessionToken() {
  return hmac(`session:${env("APP_PIN", 6)}`).toString("base64url");
}

export function isValidSession(token: string | undefined) {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(sessionToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time: both sides are hashed to the same length first. */
export function pinMatches(input: string) {
  return timingSafeEqual(hmac(`pin:${input}`), hmac(`pin:${env("APP_PIN", 6)}`));
}

// ponytail: in-memory and global (not per IP, since forwarded IPs can be
// spoofed). 10 misses per 15 min caps guessing; already-signed-in devices keep
// working. Move to the DB if this ever runs as more than one process.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;
const failures: number[] = [];

export function loginLocked() {
  const cutoff = Date.now() - WINDOW_MS;
  while (failures.length && failures[0] < cutoff) failures.shift();
  return failures.length >= MAX_FAILURES;
}

export function recordFailedLogin() {
  failures.push(Date.now());
}

/** Every Server Action calls this; the proxy alone is not a security boundary. */
export async function requireAuth() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSession(token)) redirect("/login");
}

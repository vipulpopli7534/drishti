import { RUDE_WAIT_MS } from "../config";
import { TrackedSession } from "../daemon/types";

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

/** "answered in 12s" / "waiting 4m — still waiting… rude" / plain elapsed time. */
export function describeTiming(session: TrackedSession, now: number = Date.now()): string {
  const elapsed = now - session.stateEnteredAt;
  if (session.state === "IDLE" && session.lastBlockDurationMs !== undefined) {
    return `answered in ${formatDuration(session.lastBlockDurationMs)}`;
  }
  if (session.state === "BLOCKED") {
    const waited = `waiting ${formatDuration(elapsed)}`;
    return elapsed > RUDE_WAIT_MS ? `${waited} — still waiting… rude` : waited;
  }
  return formatDuration(elapsed);
}

/** Prefer the chat-style prompt preview; fall back to the directory-derived label. */
export function displayName(session: TrackedSession): string {
  return session.promptPreview ?? session.label;
}

import { PROMPT_PREVIEW_MAX_LENGTH } from "../config";
import { EventSink, HookPayload, SessionLightState, SessionQuery, TrackedSession } from "./types";
import { reduce } from "./stateMachine";
import { computeLabel } from "./labeling";

const STATE_PRIORITY: Record<SessionLightState, number> = {
  BLOCKED: 3,
  RUNNING: 2,
  IDLE: 1,
};

/** First prompt, truncated — the closest hook-exposed stand-in for a chat title. */
function extractPromptPreview(payload: HookPayload): string | undefined {
  if (payload.hook_event_name !== "UserPromptSubmit") return undefined;
  // Docs describe this field as prompt_text; real payloads send it as prompt
  // (verified live) — accept either in case that varies across versions.
  const text = payload.prompt ?? payload.prompt_text;
  if (typeof text !== "string" || text.trim().length === 0) return undefined;
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > PROMPT_PREVIEW_MAX_LENGTH ? `${trimmed.slice(0, PROMPT_PREVIEW_MAX_LENGTH)}…` : trimmed;
}

export class SessionStore implements EventSink, SessionQuery {
  private sessions = new Map<string, TrackedSession>();

  /** Applies a hook payload, creating the session on first sight if needed. */
  apply(payload: HookPayload): void {
    const now = Date.now();

    if (payload.hook_event_name === "SessionEnd") {
      this.sessions.delete(payload.session_id);
      return;
    }

    const existing = this.sessions.get(payload.session_id);
    const nextState = reduce(existing?.state, payload);

    if (!existing) {
      // Auto-create even for non-SessionStart events (self-heal after a
      // daemon restart, or an event arriving before we saw SessionStart).
      this.sessions.set(payload.session_id, {
        sessionId: payload.session_id,
        cwd: payload.cwd,
        label: computeLabel(payload.cwd),
        state: nextState ?? "IDLE",
        stateEnteredAt: now,
        lastEventAt: now,
        promptPreview: extractPromptPreview(payload),
      });
      return;
    }

    existing.lastEventAt = now;
    if (!existing.promptPreview) {
      existing.promptPreview = extractPromptPreview(payload);
    }
    if (nextState && nextState !== existing.state) {
      if (existing.state === "BLOCKED") {
        existing.lastBlockDurationMs = now - existing.stateEnteredAt;
      }
      existing.state = nextState;
      existing.stateEnteredAt = now;
    }
  }

  getAll(): TrackedSession[] {
    return Array.from(this.sessions.values());
  }

  /** Highest-priority state across all tracked sessions, or undefined if none tracked. */
  computeAggregate(): SessionLightState | undefined {
    let best: SessionLightState | undefined;
    for (const session of this.sessions.values()) {
      if (!best || STATE_PRIORITY[session.state] > STATE_PRIORITY[best]) {
        best = session.state;
      }
    }
    return best;
  }
}

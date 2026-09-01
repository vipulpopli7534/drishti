export type SessionLightState = "BLOCKED" | "RUNNING" | "IDLE";

export interface TrackedSession {
  sessionId: string;
  cwd: string;
  label: string;
  state: SessionLightState;
  stateEnteredAt: number;
  lastEventAt: number;
  /** How long the *previous* BLOCKED spell lasted, set the moment it's left. Petty-stats fuel. */
  lastBlockDurationMs?: number;
  /**
   * A chat-style title derived from the first prompt, e.g. "fix the login
   * bug". There's no hook-exposed equivalent of the desktop app's own
   * generated conversation title, so this is the closest achievable stand-in.
   */
  promptPreview?: string;
}

export interface HookPayload {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  notification_type?: string;
  permission_status?: string;
  [key: string]: unknown;
}

/** Read-only view of tracked sessions — all the UI layer should ever depend on. */
export interface SessionQuery {
  getAll(): TrackedSession[];
  computeAggregate(): SessionLightState | undefined;
}

/** Write side — all the HTTP transport should ever depend on. */
export interface EventSink {
  apply(payload: HookPayload): void;
}

import { BLOCKING_NOTIFICATION_TYPES, HUMAN_INPUT_TOOL_NAMES, RESOLVING_NOTIFICATION_TYPES } from "../config";
import { HookPayload, SessionLightState } from "./types";

type Transition = SessionLightState | null;
type Handler = (payload: HookPayload, prevState: SessionLightState | undefined) => Transition;

function handlePreToolUse(payload: HookPayload): Transition {
  const toolName = (payload.tool_name as string | undefined) ?? "";
  return HUMAN_INPUT_TOOL_NAMES.has(toolName) ? "BLOCKED" : "RUNNING";
}

function handlePermissionRequest(payload: HookPayload): Transition {
  if (payload.permission_status === "pending") return "BLOCKED";
  if (payload.permission_status === "approved" || payload.permission_status === "denied") return "RUNNING";
  return null;
}

function handleNotification(payload: HookPayload): Transition {
  const type = payload.notification_type ?? "";
  if (BLOCKING_NOTIFICATION_TYPES.has(type)) return "BLOCKED";
  if (RESOLVING_NOTIFICATION_TYPES.has(type)) return "RUNNING";
  return null;
}

const alwaysRunning: Handler = () => "RUNNING";

/**
 * One entry per hook event this daemon understands. To support a new event,
 * add a line here — nothing else in this file needs to change. SessionEnd
 * has no entry: it's not a state transition, the session store removes the
 * session entirely (see sessionStore.ts).
 */
const HOOK_HANDLERS: Record<string, Handler> = {
  SessionStart: () => "IDLE",
  PreToolUse: handlePreToolUse,
  UserPromptSubmit: alwaysRunning,
  PostToolUse: alwaysRunning,
  PostToolUseFailure: alwaysRunning,
  PermissionRequest: handlePermissionRequest,
  Notification: handleNotification,
  Stop: () => "IDLE",
};

/**
 * Pure reducer: given the previous state (undefined if the session isn't
 * tracked yet) and an incoming hook payload, return the next state, or
 * `null` to mean "no-op, ignore this event" (unrecognized event/type, or a
 * SessionEnd — session removal is handled by the caller, not by this table).
 */
export function reduce(prevState: SessionLightState | undefined, payload: HookPayload): SessionLightState | null {
  const handler = HOOK_HANDLERS[payload.hook_event_name];
  return handler ? handler(payload, prevState) : null;
}

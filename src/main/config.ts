export const PORT = 4317;
export const HOST = "127.0.0.1";

// Tray animation timing.
export const BLINK_INTERVAL_MS = 550;
export const POP_STEP_MS = 120;

// Dropdown copy thresholds.
export const RUDE_WAIT_MS = 2 * 60 * 1000;
export const PROMPT_PREVIEW_MAX_LENGTH = 48;

// --- State machine extension points -------------------------------------
// This is the one place to touch when extending what counts as "blocked".

// Tool names whose entire purpose is to block on a human choice. Unlike the
// Stop-ambiguity gap (see stateMachine.ts), this isn't a guess: PreToolUse
// for one of these can only resolve once a human acts, so treat entry into
// the tool itself as BLOCKED rather than RUNNING.
export const HUMAN_INPUT_TOOL_NAMES = new Set(["AskUserQuestion"]);

// Notification sub-types (the hook_event_name: "Notification" payload's
// notification_type field) that mean "blocked on you" vs "you just resolved
// it". Anything not listed here is informational and ignored.
export const BLOCKING_NOTIFICATION_TYPES = new Set([
  "permission_prompt",
  "idle_prompt",
  "agent_needs_input",
  "elicitation_dialog",
  "elicitation_url_dialog",
]);

export const RESOLVING_NOTIFICATION_TYPES = new Set(["elicitation_complete", "elicitation_response"]);

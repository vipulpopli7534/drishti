import assert from "node:assert/strict";
import { test } from "node:test";
import { reduce } from "./stateMachine";
import { HookPayload } from "./types";

function payload(overrides: Partial<HookPayload> & Pick<HookPayload, "hook_event_name">): HookPayload {
  return { session_id: "s1", cwd: "/tmp", ...overrides };
}

test("SessionStart always goes IDLE", () => {
  assert.equal(reduce(undefined, payload({ hook_event_name: "SessionStart" })), "IDLE");
  assert.equal(reduce("BLOCKED", payload({ hook_event_name: "SessionStart" })), "IDLE");
});

test("PreToolUse goes RUNNING for an ordinary tool", () => {
  const result = reduce("IDLE", payload({ hook_event_name: "PreToolUse", tool_name: "Bash" }));
  assert.equal(result, "RUNNING");
});

test("PreToolUse goes BLOCKED for a human-input tool (AskUserQuestion)", () => {
  const result = reduce("RUNNING", payload({ hook_event_name: "PreToolUse", tool_name: "AskUserQuestion" }));
  assert.equal(result, "BLOCKED");
});

for (const event of ["UserPromptSubmit", "PostToolUse", "PostToolUseFailure"]) {
  test(`${event} goes RUNNING`, () => {
    assert.equal(reduce("IDLE", payload({ hook_event_name: event })), "RUNNING");
  });
}

test("PermissionRequest pending goes BLOCKED", () => {
  const result = reduce("RUNNING", payload({ hook_event_name: "PermissionRequest", permission_status: "pending" }));
  assert.equal(result, "BLOCKED");
});

for (const status of ["approved", "denied"]) {
  test(`PermissionRequest ${status} goes RUNNING`, () => {
    const result = reduce("BLOCKED", payload({ hook_event_name: "PermissionRequest", permission_status: status }));
    assert.equal(result, "RUNNING");
  });
}

test("PermissionRequest with an unrecognized status is a no-op", () => {
  const result = reduce("BLOCKED", payload({ hook_event_name: "PermissionRequest", permission_status: "weird" }));
  assert.equal(result, null);
});

for (const type of ["permission_prompt", "idle_prompt", "agent_needs_input", "elicitation_dialog", "elicitation_url_dialog"]) {
  test(`Notification(${type}) goes BLOCKED`, () => {
    const result = reduce("RUNNING", payload({ hook_event_name: "Notification", notification_type: type }));
    assert.equal(result, "BLOCKED");
  });
}

for (const type of ["elicitation_complete", "elicitation_response"]) {
  test(`Notification(${type}) goes RUNNING`, () => {
    const result = reduce("BLOCKED", payload({ hook_event_name: "Notification", notification_type: type }));
    assert.equal(result, "RUNNING");
  });
}

test("Notification with an unrecognized type is a no-op, never a guess", () => {
  const result = reduce("BLOCKED", payload({ hook_event_name: "Notification", notification_type: "auth_success" }));
  assert.equal(result, null);
});

test("Stop always goes IDLE", () => {
  assert.equal(reduce("RUNNING", payload({ hook_event_name: "Stop" })), "IDLE");
  assert.equal(reduce("BLOCKED", payload({ hook_event_name: "Stop" })), "IDLE");
});

test("SessionEnd is a no-op in the reducer (removal is the session store's job)", () => {
  assert.equal(reduce("IDLE", payload({ hook_event_name: "SessionEnd" })), null);
});

test("an entirely unrecognized hook event is a no-op, not a guess", () => {
  assert.equal(reduce("RUNNING", payload({ hook_event_name: "SomeFutureEvent" })), null);
});

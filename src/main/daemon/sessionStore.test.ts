import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore } from "./sessionStore";
import { HookPayload } from "./types";

function payload(overrides: Partial<HookPayload> & Pick<HookPayload, "hook_event_name">): HookPayload {
  return { session_id: "s1", cwd: "/tmp/my-project", ...overrides };
}

test("SessionStart creates a tracked session labeled from the cwd", () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "SessionStart" }));
  const [session] = store.getAll();
  assert.equal(session.state, "IDLE");
  assert.equal(session.label, "my-project");
});

test("an event for an unknown session_id self-heals by auto-creating it", () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "PreToolUse", tool_name: "Bash" }));
  const [session] = store.getAll();
  assert.equal(session.sessionId, "s1");
  assert.equal(session.state, "RUNNING");
});

test("the first prompt becomes the promptPreview and later prompts don't overwrite it", () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "UserPromptSubmit", prompt: "fix the login bug" }));
  store.apply(payload({ hook_event_name: "UserPromptSubmit", prompt: "actually never mind" }));
  const [session] = store.getAll();
  assert.equal(session.promptPreview, "fix the login bug");
});

test("a long prompt is truncated for the preview", () => {
  const store = new SessionStore();
  const longPrompt = "a".repeat(200);
  store.apply(payload({ hook_event_name: "UserPromptSubmit", prompt: longPrompt }));
  const [session] = store.getAll();
  assert.ok(session.promptPreview !== undefined && session.promptPreview.length < longPrompt.length);
  assert.ok(session.promptPreview?.endsWith("…"));
});

test("leaving BLOCKED records lastBlockDurationMs", async () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "PreToolUse", tool_name: "AskUserQuestion" }));
  assert.equal(store.getAll()[0].state, "BLOCKED");

  await new Promise((resolve) => setTimeout(resolve, 5));
  store.apply(payload({ hook_event_name: "PostToolUse", tool_name: "AskUserQuestion" }));

  const [session] = store.getAll();
  assert.equal(session.state, "RUNNING");
  assert.ok(session.lastBlockDurationMs !== undefined && session.lastBlockDurationMs >= 0);
});

test("SessionEnd removes the session entirely", () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "SessionStart" }));
  assert.equal(store.getAll().length, 1);
  store.apply(payload({ hook_event_name: "SessionEnd" }));
  assert.equal(store.getAll().length, 0);
});

test("an unrecognized event updates lastEventAt but never changes state", () => {
  const store = new SessionStore();
  store.apply(payload({ hook_event_name: "SessionStart" }));
  const before = store.getAll()[0].lastEventAt;
  store.apply(payload({ hook_event_name: "SomeFutureEvent" }));
  const after = store.getAll()[0];
  assert.equal(after.state, "IDLE");
  assert.ok(after.lastEventAt >= before);
});

test("computeAggregate prioritizes BLOCKED over RUNNING over IDLE", () => {
  const store = new SessionStore();
  store.apply({ session_id: "a", cwd: "/tmp/a", hook_event_name: "SessionStart" });
  store.apply({ session_id: "b", cwd: "/tmp/b", hook_event_name: "PreToolUse", tool_name: "Bash" });
  assert.equal(store.computeAggregate(), "RUNNING");

  store.apply({ session_id: "c", cwd: "/tmp/c", hook_event_name: "PreToolUse", tool_name: "AskUserQuestion" });
  assert.equal(store.computeAggregate(), "BLOCKED");
});

test("computeAggregate is undefined with no tracked sessions", () => {
  const store = new SessionStore();
  assert.equal(store.computeAggregate(), undefined);
});

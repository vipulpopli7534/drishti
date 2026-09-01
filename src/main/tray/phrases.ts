import * as fs from "node:fs";
import * as path from "node:path";
import { SessionLightState } from "../daemon/types";

interface PhraseBank {
  BLOCKED: string[];
  RUNNING: string[];
  IDLE: string[];
  aggregateHeader: Record<"BLOCKED" | "RUNNING" | "IDLE" | "NONE", string[]>;
}

// User-editable without a rebuild: dist/main/tray -> project root -> assets/phrases.json.
const PHRASES_PATH = path.join(__dirname, "..", "..", "..", "assets", "phrases.json");

const FALLBACK: PhraseBank = {
  BLOCKED: ["waiting on you"],
  RUNNING: ["running"],
  IDLE: ["done"],
  aggregateHeader: { BLOCKED: ["needs you"], RUNNING: ["running"], IDLE: ["all clear"], NONE: ["no sessions"] },
};

// Re-read on every call rather than caching: buildMenu() only runs on tray
// click (not on the hot per-event path), so this stays off the latency-
// critical path while letting edits to phrases.json show up without a restart.
function loadPhrases(): PhraseBank {
  try {
    return JSON.parse(fs.readFileSync(PHRASES_PATH, "utf8")) as PhraseBank;
  } catch {
    return FALLBACK;
  }
}

function pickRandom(list: string[] | undefined, fallback: string): string {
  if (!list || list.length === 0) return fallback;
  return list[Math.floor(Math.random() * list.length)];
}

export function stateQuip(state: SessionLightState): string {
  const bank = loadPhrases();
  return pickRandom(bank[state], state.toLowerCase());
}

export function aggregateHeaderQuip(state: SessionLightState | "NONE"): string {
  const bank = loadPhrases();
  return pickRandom(bank.aggregateHeader?.[state], "");
}

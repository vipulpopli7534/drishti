import * as path from "node:path";

// Phase 1: directory name only. Git-branch enrichment is a Phase 5 polish item.
export function computeLabel(cwd: string): string {
  return path.basename(cwd) || cwd;
}

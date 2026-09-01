import * as fs from "node:fs";
import { app } from "electron";
import { HOST, PORT } from "./config";
import { SessionStore } from "./daemon/sessionStore";
import { startServer } from "./daemon/server";
import { TrayController } from "./tray/trayController";

// A tray app launched from the menu bar has no visible terminal, so a crash
// would otherwise vanish silently — keep a minimal last-resort log for that.
const CRASH_LOG = "/tmp/drishti-crash.log";
function logCrash(msg: string): void {
  fs.appendFileSync(CRASH_LOG, `${new Date().toISOString()} ${msg}\n`);
}
process.on("uncaughtException", (err) => logCrash(`uncaughtException: ${err.stack ?? err}`));
process.on("unhandledRejection", (err) => logCrash(`unhandledRejection: ${err}`));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(() => {
      app.dock?.hide(); // menu-bar-only utility, no dock icon on macOS

      const store = new SessionStore();
      const tray = new TrayController(store);
      startServer(HOST, PORT, store, () => tray.render());
    })
    .catch((err) => logCrash(`whenReady chain error: ${err.stack ?? err}`));

  app.on("window-all-closed", () => {
    // No windows to begin with; never quit on this — we're a tray-only app.
  });
}

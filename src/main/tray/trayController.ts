import { Menu, MenuItemConstructorOptions, Tray } from "electron";
import { SessionQuery } from "../daemon/types";
import { IconAnimator } from "./iconAnimator";
import { iconFor, menuIconFor } from "./icons";
import { describeTiming, displayName } from "./menuFormatting";
import { aggregateHeaderQuip, stateQuip } from "./phrases";

/** Composition root for the tray: wires Electron's Tray/Menu to the animator and formatters. */
export class TrayController {
  private tray: Tray;
  private iconAnimator: IconAnimator;

  constructor(private store: SessionQuery) {
    this.tray = new Tray(iconFor("NONE"));
    this.tray.setToolTip("Drishti");
    this.tray.on("click", () => this.tray.popUpContextMenu(this.buildMenu()));
    this.iconAnimator = new IconAnimator((image) => this.tray.setImage(image));
    this.render();
  }

  /** Call after every state change. */
  render(): void {
    this.iconAnimator.syncTo(this.store.computeAggregate() ?? "NONE");
  }

  private buildMenu(): Menu {
    const sessions = this.store.getAll();
    const aggregate = this.store.computeAggregate() ?? "NONE";
    const items: MenuItemConstructorOptions[] = [
      { label: aggregateHeaderQuip(aggregate) || "Drishti", enabled: false },
      { type: "separator" },
    ];

    if (sessions.length === 0) {
      items.push({ label: "No active sessions", enabled: false });
    } else {
      for (const session of sessions) {
        items.push({
          icon: menuIconFor(session.state),
          label: `${displayName(session)} — ${stateQuip(session.state)} (${describeTiming(session)})`,
          enabled: false,
        });
      }
    }

    items.push({ type: "separator" });
    items.push({ label: "Quit Drishti", role: "quit" });

    return Menu.buildFromTemplate(items);
  }
}

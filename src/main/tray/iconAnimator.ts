import { NativeImage } from "electron";
import { BLINK_INTERVAL_MS, POP_STEP_MS } from "../config";
import { SessionLightState } from "../daemon/types";
import { dimIconFor, iconFor } from "./icons";

type Aggregate = SessionLightState | "NONE";

/**
 * Owns the tray icon's blink-while-BLOCKED and pop-on-IDLE animations.
 * Deliberately knows nothing about Electron's Tray type — it just calls back
 * with the image to show, so the animation logic is testable without a
 * running Electron app.
 */
export class IconAnimator {
  private lastAggregate: Aggregate | undefined;
  private blinkTimer: NodeJS.Timeout | null = null;
  private blinkOn = true;

  constructor(private setIcon: (image: NativeImage) => void) {}

  /** Call after every state change. */
  syncTo(aggregate: Aggregate): void {
    const enteringIdleFromElsewhere =
      aggregate === "IDLE" && this.lastAggregate !== undefined && this.lastAggregate !== "IDLE";

    if (aggregate === "BLOCKED") {
      this.startBlink();
    } else {
      this.stopBlink();
      if (enteringIdleFromElsewhere) {
        this.playPop(aggregate);
      } else {
        this.setIcon(iconFor(aggregate));
      }
    }

    this.lastAggregate = aggregate;
  }

  /** Stop any running timer — call when the tray itself is being torn down. */
  dispose(): void {
    this.stopBlink();
  }

  private startBlink(): void {
    if (this.blinkTimer) return;
    this.blinkOn = true;
    this.setIcon(iconFor("BLOCKED"));
    this.blinkTimer = setInterval(() => {
      this.blinkOn = !this.blinkOn;
      this.setIcon(this.blinkOn ? iconFor("BLOCKED") : dimIconFor("BLOCKED"));
    }, BLINK_INTERVAL_MS);
  }

  private stopBlink(): void {
    if (!this.blinkTimer) return;
    clearInterval(this.blinkTimer);
    this.blinkTimer = null;
  }

  /** A quick double-flicker before settling — a little celebration for "done". */
  private playPop(state: Aggregate): void {
    const frames = [dimIconFor(state), iconFor(state), dimIconFor(state), iconFor(state)];
    let i = 0;
    const step = () => {
      this.setIcon(frames[i]);
      i++;
      if (i < frames.length) setTimeout(step, POP_STEP_MS);
    };
    step();
  }
}

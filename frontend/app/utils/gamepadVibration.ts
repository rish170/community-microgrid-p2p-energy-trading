// gamepadVibration.ts
// DualShock 4 & Standard Gamepad Haptic Feedback Engine

export interface VibrationSettings {
  strongMagnitude: number; // 0.0 to 1.0 (Left Heavy Motor)
  weakMagnitude: number;   // 0.0 to 1.0 (Right Light Motor)
}

const STORAGE_KEY = "microgrid_ps4_vibration_settings";

export function loadVibrationSettings(): VibrationSettings {
  if (typeof window === "undefined") {
    return { strongMagnitude: 0.75, weakMagnitude: 0.85 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        strongMagnitude: typeof parsed.strongMagnitude === "number" ? parsed.strongMagnitude : 0.75,
        weakMagnitude: typeof parsed.weakMagnitude === "number" ? parsed.weakMagnitude : 0.85,
      };
    }
  } catch {}
  return { strongMagnitude: 0.75, weakMagnitude: 0.85 };
}

export function saveVibrationSettings(settings: VibrationSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("microgrid_vibration_settings_updated", { detail: settings }));
  } catch {}
}

export function getActiveGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (gp && gp.connected) return gp;
  }
  return null;
}

export async function triggerRumble(
  durationMs: number,
  strong?: number,
  weak?: number,
  startDelay: number = 0
): Promise<boolean> {
  const gp = getActiveGamepad();
  if (!gp) return false;

  const currentSettings = loadVibrationSettings();
  const s = strong !== undefined ? strong : currentSettings.strongMagnitude;
  const w = weak !== undefined ? weak : currentSettings.weakMagnitude;

  const actuator = (gp as unknown as { vibrationActuator?: { playEffect: (type: string, options: object) => Promise<string> } }).vibrationActuator;
  if (!actuator || typeof actuator.playEffect !== "function") return false;

  try {
    await actuator.playEffect("dual-rumble", {
      startDelay,
      duration: Math.max(10, Math.min(10000, durationMs)),
      strongMagnitude: Math.max(0, Math.min(1, s)),
      weakMagnitude: Math.max(0, Math.min(1, w)),
    });
    return true;
  } catch (err) {
    console.warn("[Gamepad] Vibration playEffect warning:", err);
    return false;
  }
}

export async function stopRumble(): Promise<void> {
  const gp = getActiveGamepad();
  if (!gp) return;
  const actuator = (gp as unknown as { vibrationActuator?: { reset?: () => Promise<string> } }).vibrationActuator;
  if (actuator && typeof actuator.reset === "function") {
    try {
      await actuator.reset();
    } catch {}
  }
}

export async function playVibrationPattern(patternId: string, strong?: number, weak?: number) {
  const settings = loadVibrationSettings();
  const s = strong !== undefined ? strong : settings.strongMagnitude;
  const w = weak !== undefined ? weak : settings.weakMagnitude;

  switch (patternId) {
    case "pulse":
      // Crisp single punch
      await triggerRumble(130, s * 0.9, w);
      break;

    case "double_tap":
      // Tactile double tap
      await triggerRumble(75, s * 0.7, w);
      setTimeout(() => triggerRumble(95, s, w), 125);
      break;

    case "heartbeat":
      // Lub-dub pulse
      await triggerRumble(130, s, w * 0.4);
      setTimeout(() => triggerRumble(190, s * 0.85, w * 0.85), 210);
      break;

    case "engine_rev":
      // Progressive rumble build-up
      await triggerRumble(150, s * 0.35, w * 0.5);
      setTimeout(() => triggerRumble(200, s * 0.7, w * 0.8), 160);
      setTimeout(() => triggerRumble(320, s, w), 370);
      break;

    case "staccato":
      // 3 rapid burst taps
      await triggerRumble(60, s * 0.6, w);
      setTimeout(() => triggerRumble(60, s * 0.6, w), 100);
      setTimeout(() => triggerRumble(75, s * 0.9, w), 200);
      break;

    case "shockwave":
      // Max power burst
      await triggerRumble(350, 1.0, 1.0);
      break;

    default:
      await triggerRumble(100, s, w);
      break;
  }
}

// Satisfying haptic feedback when shifting focus on house
export function playShiftHaptic() {
  const settings = loadVibrationSettings();
  // Quick, punchy, tactile click
  triggerRumble(70, settings.strongMagnitude * 0.7, settings.weakMagnitude);
}

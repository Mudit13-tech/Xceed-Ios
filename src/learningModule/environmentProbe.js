/**
 * What the machine sitting this exam says about itself.
 *
 * Read on the heartbeat and assessed server-side by `services/vmSignals` for
 * signs of a virtual machine — see that file for why a VM is worth noticing at
 * all, and for the standing caveat that everything here is self-reported and so
 * is a reason to look at a laptop rather than proof of anything.
 *
 * Three rules shape this file, and all three come from where it runs: inside a
 * kiosk, during a graded exam, on hardware nobody here controls.
 *
 *  1. **It can never throw.** A probe that raises inside the heartbeat would
 *     take the heartbeat down with it, and a missing heartbeat ends sittings
 *     (`heartbeat_lost`). Every reader is individually guarded and every failure
 *     resolves to `null`, which the server reads as "could not tell" rather than
 *     as an answer.
 *  2. **It asks for no permission.** No camera, no microphone, no geolocation —
 *     nothing that puts a prompt in front of a student mid-question. Device
 *     *counts* are readable without consent; device labels are not, and are not
 *     read.
 *  3. **It is cheap and bounded.** It runs every few minutes on every machine in
 *     the hall at once, so it does no work proportional to anything and every
 *     string it returns is truncated before it is sent.
 */

/** No single field is worth more than this many characters to us. */
const MAX_FIELD = 200;

const clip = (value) =>
  typeof value === "string" ? value.slice(0, MAX_FIELD) : value;

/**
 * The graphics adapter's real name, via the debug-renderer extension.
 *
 * `getParameter(RENDERER)` on its own answers a generic "WebGL renderer" in
 * every current browser; the unmasked pair behind `WEBGL_debug_renderer_info` is
 * what actually names the hardware — and naming the hardware is the entire point
 * here, because a hypervisor's guest adapter cannot pretend to be a GeForce.
 *
 * The context is explicitly released afterwards. A sitting can run for three
 * hours and probe repeatedly; browsers cap how many live WebGL contexts a
 * document may hold, and leaking one per probe would eventually cost the page
 * its own canvases.
 */
function readWebgl() {
  let gl = null;
  try {
    const canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { webglVendor: null, webglRenderer: null };

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) {
      // Present but masked — report the generic strings rather than null, so the
      // server can tell "no WebGL" from "WebGL without the extension".
      return {
        webglVendor: clip(gl.getParameter(gl.VENDOR)),
        webglRenderer: clip(gl.getParameter(gl.RENDERER)),
      };
    }
    return {
      webglVendor: clip(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)),
      webglRenderer: clip(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
    };
  } catch {
    return { webglVendor: null, webglRenderer: null };
  } finally {
    try {
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* Releasing early is an optimisation; the context is collected regardless. */
    }
  }
}

/**
 * How many cameras and microphones exist — not which ones.
 *
 * `enumerateDevices` returns entries with empty `label`s until the page has been
 * granted media access, and this never asks for it. The counts alone carry the
 * signal that matters: a student's laptop has a webcam, and a VM spun up for an
 * exam usually has nothing passed through to it.
 */
async function readMediaDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const count = (kind) => devices.filter((device) => device.kind === kind).length;
    return {
      cameras: count("videoinput"),
      microphones: count("audioinput"),
      total: devices.length,
    };
  } catch {
    return null;
  }
}

/**
 * The battery, where the browser still exposes it.
 *
 * Chrome-family only, and increasingly restricted, so `null` here is ordinary
 * and carries no meaning. Scored gently server-side for that reason.
 */
async function readBattery() {
  try {
    if (typeof navigator.getBattery !== "function") return null;
    const battery = await navigator.getBattery();
    return {
      charging: battery.charging,
      level: battery.level,
      // Infinity does not survive JSON — it becomes `null` — so it is mapped
      // deliberately rather than left to the serialiser, and the server's rule
      // is written against `null` to match.
      dischargingTime: Number.isFinite(battery.dischargingTime) ? battery.dischargingTime : null,
    };
  } catch {
    return null;
  }
}

/**
 * The platform detail behind the User-Agent, where Client Hints are available.
 *
 * Worth asking for because the User-Agent string itself has been frozen into
 * uselessness for this purpose: it says "Windows NT 10.0" on everything from
 * Windows 10 to Windows 11, while `platformVersion` distinguishes them, and
 * `architecture`/`bitness` say whether this is the machine the student claims.
 */
async function readUserAgentData() {
  try {
    const uaData = navigator.userAgentData;
    if (!uaData?.getHighEntropyValues) return null;
    const values = await uaData.getHighEntropyValues([
      "platform",
      "platformVersion",
      "architecture",
      "bitness",
      "model",
    ]);
    return {
      platform: clip(values.platform),
      platformVersion: clip(values.platformVersion),
      architecture: clip(values.architecture),
      bitness: clip(values.bitness),
      model: clip(values.model),
    };
  } catch {
    return null;
  }
}

/**
 * One reading of this machine.
 *
 * Resolves to an object always — never rejects, never throws — because its only
 * caller is the heartbeat. The async readers run together rather than in
 * sequence: they are independent, and three awaits in a row on a slow machine is
 * three chances to be mid-probe when the next beat is due.
 */
export default async function probeEnvironment() {
  try {
    const [mediaDevices, battery, uaData] = await Promise.all([
      readMediaDevices(),
      readBattery(),
      readUserAgentData(),
    ]);

    return {
      ...readWebgl(),
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints ?? null,
      platform: clip(navigator.platform || ""),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      pixelRatio: window.devicePixelRatio ?? null,
      colorDepth: window.screen?.colorDepth ?? null,
      timeZone: clip(Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
      mediaDevices,
      battery,
      uaData,
    };
  } catch {
    // The outer guard exists only so that a browser missing something this file
    // reads without a guard of its own still leaves the heartbeat alone.
    return null;
  }
}

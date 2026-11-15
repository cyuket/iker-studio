/**
 * Runs inside the recorded page. Browser captures contain no operating-system cursor, so
 * this draws one, together with highlight rings and the styling that blurs masked elements.
 *
 * The function is serialised and injected before any page script on every navigation, so it
 * must stay self-contained: it may not reference anything outside its own body.
 */

export interface OverlayConfig {
  /** sessionStorage key that carries the cursor's position and visibility across navigations. */
  cursorStorageKey: string;
  /** Attribute the recorder sets on elements that must be blurred. */
  maskAttribute: string;
  /** Name of the function the recorder exposes to re-apply masks when the page changes. */
  maskSweepFunction: string;
  accentColour: string;
  cursorMinMs: number;
  cursorMaxMs: number;
  cursorMsPerPixel: number;
  pressMs: number;
  highlightFadeMs: number;
}

export interface StudioOverlay {
  /** Glides the cursor to a viewport point along an eased, slightly curved path. */
  moveCursor(x: number, y: number): Promise<void>;
  /** Draws the click ripple at the cursor. */
  press(): Promise<void>;
  setCursorVisible(visible: boolean): void;
  /** Rings an element, optionally labelled, holds, then removes the ring. */
  highlight(element: Element, label: string | null, holdMs: number): Promise<void>;
  /** Starts telling the recorder when the page adds content that may need masking. */
  watchForMaskTargets(): void;
}

declare global {
  interface Window {
    __studioOverlay?: StudioOverlay;
  }
}

export function overlayPageScript(config: OverlayConfig): void {
  if (window !== window.top || window.__studioOverlay) return;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;pointer-events:none;margin:0;padding:0;border:0;";
  // A shadow root keeps the page's styles away from the overlay and the overlay's nodes
  // out of the page's own queries and mutation observers.
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .cursor { position: fixed; left: 0; top: 0; z-index: 2; width: 26px; height: 26px; will-change: transform;
        filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.45)); }
      .cursor[hidden] { display: none; }
      .ripple { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        background: ${config.accentColour}; opacity: 0; }
      .ring { position: fixed; box-sizing: border-box; border: 3px solid ${config.accentColour}; border-radius: 10px;
        box-shadow: 0 0 0 5px ${config.accentColour}33, 0 8px 28px rgba(15, 23, 42, 0.18);
        opacity: 0; transition: opacity ${config.highlightFadeMs}ms ease-out; }
      .tag { position: fixed; padding: 5px 12px 6px; background: ${config.accentColour};
        color: #fff; font: 600 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
        white-space: nowrap;
        opacity: 0; transition: opacity ${config.highlightFadeMs}ms ease-out; }
      .shown { opacity: 1; }
    </style>
    <div class="ripple"></div>
    <svg class="cursor" hidden viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 2.5 L4 21 L9.2 16.4 L12.6 24 L16 22.5 L12.7 15 L19.5 15 Z"
        fill="#0f172a" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round" />
    </svg>`;
  const cursor = root.querySelector(".cursor") as SVGElement;
  const ripple = root.querySelector(".ripple") as HTMLElement;

  const maskStyle = document.createElement("style");
  maskStyle.textContent = `[${config.maskAttribute}] { filter: blur(14px) !important; }`;

  const state = readStoredState() ?? {
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.58,
    visible: false,
  };
  placeCursor(state.x, state.y);
  cursor.toggleAttribute("hidden", !state.visible);
  mountWhenDocumentExists();

  /** Frameworks that take over <html> can drop foreign nodes, so re-attach before each use. */
  function mount(): void {
    if (!host.isConnected) document.documentElement.append(host);
    if (!maskStyle.isConnected) document.documentElement.append(maskStyle);
  }

  /** This script can run before the parser has created <html>. */
  function mountWhenDocumentExists(): void {
    if (document.querySelector("html")) {
      mount();
      return;
    }
    new MutationObserver((_records, observer) => {
      if (!document.querySelector("html")) return;
      observer.disconnect();
      mount();
    }).observe(document, { childList: true });
  }

  function readStoredState(): { x: number; y: number; visible: boolean } | null {
    try {
      const stored = window.sessionStorage.getItem(config.cursorStorageKey);
      if (!stored) return null;
      const [x, y, visible] = stored.split(",").map(Number);
      return x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)
        ? { x, y, visible: visible === 1 }
        : null;
    } catch {
      // Storage is unavailable on some documents (opaque origins); the defaults are fine.
      return null;
    }
  }

  function storeState(): void {
    try {
      const value = `${state.x},${state.y},${state.visible ? 1 : 0}`;
      window.sessionStorage.setItem(config.cursorStorageKey, value);
    } catch {
      // Same as above: without storage the cursor restarts from its defaults after navigation.
    }
  }

  function placeCursor(x: number, y: number): void {
    state.x = x;
    state.y = y;
    // The arrow's tip sits at (4, 2.5) inside its 26px box.
    cursor.style.transform = `translate(${x - 4}px, ${y - 2.5}px)`;
  }

  function animate(durationMs: number, draw: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now: number): void => {
        const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
        draw(progress);
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  async function moveCursor(x: number, y: number): Promise<void> {
    mount();
    const from = { x: state.x, y: state.y };
    const distance = Math.hypot(x - from.x, y - from.y);
    if (distance < 1) return;
    // A hand never travels dead straight: bow the path sideways by a fixed share of its length.
    const bow = Math.min(60, distance * 0.12);
    const control = {
      x: (from.x + x) / 2 - ((y - from.y) / distance) * bow,
      y: (from.y + y) / 2 + ((x - from.x) / distance) * bow,
    };
    const durationMs = Math.min(
      config.cursorMaxMs,
      Math.max(config.cursorMinMs, distance * config.cursorMsPerPixel),
    );
    await animate(durationMs, (progress) => {
      const t = easeInOut(progress);
      const u = 1 - t;
      placeCursor(
        u * u * from.x + 2 * u * t * control.x + t * t * x,
        u * u * from.y + 2 * u * t * control.y + t * t * y,
      );
    });
    storeState();
  }

  async function press(): Promise<void> {
    mount();
    ripple.style.left = `${state.x}px`;
    ripple.style.top = `${state.y}px`;
    await animate(config.pressMs, (progress) => {
      ripple.style.opacity = String(0.45 * (1 - progress));
      ripple.style.transform = `scale(${0.35 + 0.65 * progress})`;
    });
    ripple.style.opacity = "0";
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function highlight(element: Element, label: string | null, holdMs: number): Promise<void> {
    mount();
    const ring = document.createElement("div");
    ring.className = "ring";
    const tag = label ? document.createElement("div") : null;
    if (tag) {
      tag.className = "tag";
      tag.textContent = label;
    }
    root.append(ring, ...(tag ? [tag] : []));

    let tracking = true;
    // Follow the element every frame so the ring stays glued to it if the page reflows.
    const track = (): void => {
      if (!tracking) return;
      const box = element.getBoundingClientRect();
      const pad = 6;
      ring.style.left = `${box.left - pad}px`;
      ring.style.top = `${box.top - pad}px`;
      ring.style.width = `${box.width + pad * 2}px`;
      ring.style.height = `${box.height + pad * 2}px`;
      if (tag) {
        // The label hangs off the ring like a tab, so it reads as part of the callout
        // rather than as a stray box over the page. It moves below the element when
        // there is no room above.
        const above = box.top - pad - tag.offsetHeight;
        const fitsAbove = above >= 44;
        tag.style.left = `${box.left - pad}px`;
        tag.style.top = `${fitsAbove ? above + 1 : box.bottom + pad - 1}px`;
        tag.style.borderRadius = fitsAbove ? "8px 8px 0 0" : "0 0 8px 8px";
        ring.style.borderTopLeftRadius = fitsAbove ? "0" : "";
        ring.style.borderBottomLeftRadius = fitsAbove ? "" : "0";
      }
      requestAnimationFrame(track);
    };
    track();

    ring.classList.add("shown");
    tag?.classList.add("shown");
    await wait(config.highlightFadeMs + holdMs);
    ring.classList.remove("shown");
    tag?.classList.remove("shown");
    await wait(config.highlightFadeMs);
    tracking = false;
    ring.remove();
    tag?.remove();
  }

  let sweepQueued = false;
  let watching = false;
  function watchForMaskTargets(): void {
    mount();
    if (watching) return;
    watching = true;
    const requestSweep = (window as unknown as Record<string, (() => Promise<void>) | undefined>)[
      config.maskSweepFunction
    ];
    if (!requestSweep) return;
    // Client-rendered pages add content long after load; ask for a sweep once per frame at
    // most whenever nodes appear, so new matches are blurred as soon as they exist.
    new MutationObserver(() => {
      if (sweepQueued) return;
      sweepQueued = true;
      requestAnimationFrame(() => {
        sweepQueued = false;
        void requestSweep();
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.__studioOverlay = {
    moveCursor,
    press,
    setCursorVisible: (visible) => {
      mount();
      state.visible = visible;
      cursor.toggleAttribute("hidden", !visible);
      storeState();
    },
    highlight,
    watchForMaskTargets,
  };
}

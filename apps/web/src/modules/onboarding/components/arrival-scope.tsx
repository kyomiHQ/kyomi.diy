import { useRouterState } from "@tanstack/react-router";
import { accentChain } from "glimm";
import {
  GlimmScope,
  supportsHtmlInCanvas,
  usePageEffect,
  type GlimmScopeHandle,
} from "glimm/react";
import { useRef, useState, type PropsWithChildren } from "react";
import { flushSync } from "react-dom";
import { InboxArrivalTransition } from "../lib/arrival-transition";

const palette = accentChain(["#7775E8", "#AE73DC", "#E5A1A9"]);

function waitForCaptureFrame() {
  return new Promise<void>((resolve) => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(finish);
    });
    function finish() {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", finish);
      resolve();
    }
    document.addEventListener("visibilitychange", finish);
  });
}

export function ArrivalScope({ children }: PropsWithChildren) {
  const onboarding = useRouterState({
    select: (state) => state.location.pathname === "/onboarding",
  });
  const scope = useRef<GlimmScopeHandle>(null);
  const [pageEffectEnabled] = usePageEffect();
  const [phase, setPhase] = useState<"idle" | "sweep" | "capture">("idle");
  const active = onboarding || phase !== "idle";

  async function play(change: () => Promise<void>, at?: [number, number]) {
    const transition = scope.current;
    if (!transition || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return change();
    }

    const capture = pageEffectEnabled && supportsHtmlInCanvas();
    flushSync(() => setPhase(capture ? "capture" : "sweep"));
    // Glimm enables its surface in effects, then Chrome paints the outgoing DOM into it.
    if (capture) await waitForCaptureFrame();

    return new Promise<void>((resolve, reject) => {
      transition.play({
        at,
        change: () => Promise.resolve().then(change).then(resolve, reject),
        onLeave: () => setPhase("idle"),
      });
    });
  }

  return (
    <InboxArrivalTransition.Provider value={play}>
      <GlimmScope
        ref={scope}
        style={active ? { height: "100dvh" } : { overflow: "visible" }}
        pageEffect={phase === "capture"}
        direction="rtl"
        curve={0.1}
        span={0.8}
        palette={palette}
        sweepMs={850}
        brightness={0.85}
        peakAlpha={0.85}
      >
        {/* Composite translucent controls over the theme background inside the captured page. */}
        <div className={active ? "h-full overflow-y-auto bg-background" : undefined}>
          {children}
        </div>
      </GlimmScope>
    </InboxArrivalTransition.Provider>
  );
}

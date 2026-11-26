import { getSvgPath } from "figma-squircle";
import { type CSSProperties, useEffect, useRef, useState } from "react";

export type SquircleStyleOptions = {
  cornerRadius: number;
  height: number;
  width: number;
  cornerSmoothing?: number;
};

export function createSquirclePath({
  cornerRadius,
  cornerSmoothing = 1,
  height,
  width,
}: SquircleStyleOptions): string {
  return getSvgPath({
    width,
    height,
    cornerRadius,
    cornerSmoothing,
  });
}

export function createSquircleStyle(options: SquircleStyleOptions): CSSProperties {
  const path = createSquirclePath(options);

  return {
    borderRadius: options.cornerRadius,
    clipPath: `path('${path}')`,
    WebkitClipPath: `path('${path}')`,
  };
}

export function useSquircle<T extends HTMLElement = HTMLElement>(
  cornerRadius: number | `${number}%`,
  cornerSmoothing = 1,
) {
  const ref = useRef<T | null>(null);
  const [shape, setShape] = useState<{ path: string | null; style: CSSProperties }>({
    path: null,
    style: typeof cornerRadius === "number" ? { borderRadius: cornerRadius } : {},
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const { offsetWidth, offsetHeight } = element;
      if (offsetWidth > 0 && offsetHeight > 0) {
        const options = {
          width: offsetWidth,
          height: offsetHeight,
          // One radius for both axes, scaled from the shorter side.
          cornerRadius:
            typeof cornerRadius === "number"
              ? cornerRadius
              : (Math.min(offsetWidth, offsetHeight) * Number.parseFloat(cornerRadius)) / 100,
          cornerSmoothing,
        };
        setShape({ path: createSquirclePath(options), style: createSquircleStyle(options) });
      }
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
  }, [cornerRadius, cornerSmoothing]);

  // `path` is the measured outline in the element's own pixels, for drawing an edge a clip would cut.
  return { ref, style: shape.style, path: shape.path };
}

export { getSvgPath };

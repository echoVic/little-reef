import { useEffect, useRef } from "react";
import { drawPortrait } from "./species";

interface VisitorPortraitProps {
  species: string;
}

// Paints a still portrait once the box has a size, and repaints on resize.
export function VisitorPortrait({ species }: VisitorPortraitProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width && entry.contentRect.height) drawPortrait(canvas, species);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [species]);

  return <canvas ref={ref} className="portrait" aria-hidden="true" />;
}

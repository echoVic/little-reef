import { useEffect, useRef } from "react";
import { Reef } from "./Reef";
import type { MutableRefObject } from "react";

interface ReefCanvasProps {
  reefRef: MutableRefObject<Reef | null>;
}

// Owns the imperative Reef engine: construct it once against the canvas and let
// the parent push snapshots in. The engine handles its own RAF loop/resize.
export function ReefCanvas({ reefRef }: ReefCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const reef = new Reef(canvasRef.current);
    reefRef.current = reef;
    return () => {
      reefRef.current = null;
      reef.resizeObserver.disconnect();
    };
  }, [reefRef]);

  return <canvas id="ocean" ref={canvasRef} aria-label="鱼儿在水草之间缓慢游动" />;
}

"use client";

import { BaseEdge, type EdgeProps, getSimpleBezierPath } from "@xyflow/react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function MissionConnectionEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style,
  selected,
  animated,
  markerEnd,
  interactionWidth = 28
}: EdgeProps) {
  const [edgePath] = getSimpleBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const strokeWidth = resolveStrokeWidth(style?.strokeWidth, Boolean(animated));
  const glowStrokeWidth = strokeWidth + 4;
  const motionPathId = `mission-edge-motion-${sanitizeDomId(id)}`;
  const packetSpecs = animated
    ? [
        { size: 4.6, halo: 8.4, duration: 2.4, delay: 0, alpha: 0.96 },
        { size: 3.2, halo: 6.4, duration: 2.95, delay: 0.78, alpha: 0.86 },
        { size: 2.2, halo: 5.2, duration: 2.65, delay: 1.42, alpha: 0.8 }
      ]
    : [];

  const glowStyle: CSSProperties = {
    ...style,
    animation: "none",
    pointerEvents: "none",
    strokeDasharray: "none",
    strokeWidth: glowStrokeWidth
  };

  const coreStyle: CSSProperties = {
    ...style,
    animation: "none",
    pointerEvents: "none",
    strokeDasharray: "none",
    strokeWidth
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={cn(
          "mission-edge__path mission-edge__path--glow",
          animated && "mission-edge__path--animated",
          selected && "mission-edge__path--selected"
        )}
        interactionWidth={0}
        style={glowStyle}
      />
      <BaseEdge
        path={edgePath}
        className={cn(
          "mission-edge__path mission-edge__path--core",
          animated && "mission-edge__path--animated",
          selected && "mission-edge__path--selected"
        )}
        interactionWidth={interactionWidth}
        markerEnd={markerEnd}
        style={coreStyle}
      />
      {animated ? (
        <path
          id={motionPathId}
          d={edgePath}
          fill="none"
          stroke="none"
          opacity={0}
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {packetSpecs.map((packet, index) => (
        <g
          key={`${motionPathId}-packet-${index}`}
          className="mission-edge__packet"
          style={
            {
              color: "var(--mission-edge-packet)",
              opacity: packet.alpha,
              filter: "drop-shadow(0 0 10px var(--mission-edge-glow-active))"
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <circle r={packet.halo} fill="currentColor" opacity={0.16} />
          <circle r={packet.size} fill="currentColor" opacity={0.95} />
          <animateMotion
            dur={`${packet.duration}s`}
            begin={`${packet.delay}s`}
            repeatCount="indefinite"
            rotate="auto"
          >
            <mpath href={`#${motionPathId}`} />
          </animateMotion>
        </g>
      ))}
    </>
  );
}

function resolveStrokeWidth(strokeWidth: unknown, animated: boolean) {
  if (typeof strokeWidth === "number" && Number.isFinite(strokeWidth)) {
    return strokeWidth;
  }

  if (typeof strokeWidth === "string") {
    const parsed = Number.parseFloat(strokeWidth);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return animated ? 2.95 : 2.25;
}

function sanitizeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PesadillaAvatar, type PesadillaMood } from "@/components/pesadilla-avatar";

export type MascotState = "idle" | "listening" | "thinking" | "speaking" | "success" | "happy" | "warning" | "confused" | "error" | "sleeping" | "surprised" | "cancelled";

type AnimatedAssistantMascotProps = {
  state?: MascotState;
  isOpen: boolean;
  isUserTyping?: boolean;
  isStreaming?: boolean;
  hasError?: boolean;
  isListening?: boolean;
  reducedMotion?: boolean;
  className?: string;
};

type Drift = { x: number; y: number; rotate: number; scale: number };

const rest: Drift = { x: 0, y: 0, rotate: 0, scale: 1 };

function toGhostMood(state: MascotState): PesadillaMood {
  if (state === "thinking" || state === "confused") return "thinking";
  if (state === "listening") return "listening";
  if (state === "success" || state === "happy") return "success";
  if (state === "cancelled" || state === "error" || state === "warning") return "cancelled";
  if (state === "speaking" || state === "surprised") return "ready";
  return "idle";
}

function chooseIdleDrift(isMobile: boolean): Drift {
  const horizontal = isMobile ? 18 : 42;
  const vertical = isMobile ? 8 : 18;
  return {
    x: Math.round((Math.random() - 0.5) * horizontal * 2),
    y: Math.round((Math.random() - 0.5) * vertical * 2),
    rotate: Number(((Math.random() - 0.5) * 7).toFixed(1)),
    scale: Number((0.985 + Math.random() * 0.04).toFixed(3)),
  };
}

/**
 * Keeps the existing Pesadilla SVG intact while supplying movement, eye focus
 * and state-aware reactions. All timer work pauses as soon as the panel closes.
 */
export function AnimatedAssistantMascot({
  state = "idle",
  isOpen,
  isUserTyping = false,
  isStreaming = false,
  hasError = false,
  isListening = false,
  reducedMotion: reducedMotionOverride,
  className = "",
}: AnimatedAssistantMascotProps) {
  const motionReduced = useReducedMotion();
  const reduceMotion = Boolean(reducedMotionOverride ?? motionReduced);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerResetRef = useRef<number | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerTargetRef = useRef({ x: 0, y: 0, lean: 0 });
  const [visible, setVisible] = useState(true);
  const [finePointer, setFinePointer] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drift, setDrift] = useState<Drift>(rest);
  const [look, setLook] = useState({ x: 0, y: 0, lean: 0 });
  const [blink, setBlink] = useState(false);
  const [microScale, setMicroScale] = useState(1);

  const visualState: MascotState = hasError ? "error" : isListening ? "listening" : isStreaming ? "speaking" : isUserTyping && state === "idle" ? "listening" : state;
  const isIdle = visualState === "idle";
  const isAnimating = isOpen && visible && !reduceMotion;

  useEffect(() => {
    const updateEnvironment = () => {
      setFinePointer(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
      setIsMobile(window.matchMedia("(max-width: 640px), (pointer: coarse)").matches);
    };
    const updateVisibility = () => setVisible(!document.hidden);
    updateEnvironment();
    updateVisibility();
    window.addEventListener("resize", updateEnvironment, { passive: true });
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      window.removeEventListener("resize", updateEnvironment);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isAnimating || !isIdle) {
      setDrift(rest);
      return;
    }
    let timeout = 0;
    const wander = () => {
      setDrift(chooseIdleDrift(isMobile));
      timeout = window.setTimeout(wander, 3600 + Math.round(Math.random() * 2600));
    };
    timeout = window.setTimeout(wander, 1100 + Math.round(Math.random() * 900));
    return () => window.clearTimeout(timeout);
  }, [isAnimating, isIdle, isMobile]);

  useEffect(() => {
    if (!isAnimating || !isIdle) {
      setBlink(false);
      setMicroScale(1);
      return;
    }
    let timeout = 0;
    const microAnimation = () => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 120);
      if (Math.random() > 0.72) {
        window.setTimeout(() => setBlink(true), 250);
        window.setTimeout(() => setBlink(false), 370);
      }
      if (Math.random() > 0.6) {
        setMicroScale(1.045);
        window.setTimeout(() => setMicroScale(1), 380);
      }
      timeout = window.setTimeout(microAnimation, 3100 + Math.round(Math.random() * 3600));
    };
    timeout = window.setTimeout(microAnimation, 1800 + Math.round(Math.random() * 1800));
    return () => window.clearTimeout(timeout);
  }, [isAnimating, isIdle]);

  useEffect(() => () => {
    if (pointerResetRef.current) window.clearTimeout(pointerResetRef.current);
    if (pointerFrameRef.current) window.cancelAnimationFrame(pointerFrameRef.current);
  }, []);

  const resetPointer = () => {
    if (pointerResetRef.current) window.clearTimeout(pointerResetRef.current);
    if (pointerFrameRef.current) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pointerResetRef.current = window.setTimeout(() => setLook({ x: 0, y: 0, lean: 0 }), 80);
  };

  const followPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reduceMotion || !isOpen) return;
    if (pointerResetRef.current) window.clearTimeout(pointerResetRef.current);
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = Math.max(-1, Math.min(1, (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2)));
    const normalizedY = Math.max(-1, Math.min(1, (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2)));
    pointerTargetRef.current = { x: Number((normalizedX * 1.35).toFixed(2)), y: Number((normalizedY * 0.72).toFixed(2)), lean: Number((normalizedX * 2.8).toFixed(2)) };
    if (pointerFrameRef.current) return;
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = null;
      setLook(pointerTargetRef.current);
    });
  };

  const speaking = visualState === "speaking";
  const thinking = visualState === "thinking";
  const error = visualState === "error";
  const success = visualState === "success" || visualState === "happy";
  const activeDrift = reduceMotion ? rest : drift;

  return (
    <div ref={stageRef} className={`assistant-mascot-stage ${className}`} onPointerMove={followPointer} onPointerLeave={resetPointer}>
      <motion.div
        className="assistant-mascot-particles"
        aria-hidden="true"
        animate={isAnimating ? { opacity: thinking ? 1 : 0.58, rotate: thinking ? 360 : 0 } : { opacity: 0.35, rotate: 0 }}
        transition={{ duration: thinking ? 5.6 : 1.2, repeat: thinking ? Infinity : 0, ease: "linear" }}
      >
        <i /><i /><i />
      </motion.div>
      <motion.div
        className="assistant-mascot-motion"
        animate={{
          x: activeDrift.x,
          y: activeDrift.y,
          rotate: activeDrift.rotate + look.lean,
          scale: activeDrift.scale * microScale,
        }}
        transition={{ type: "spring", stiffness: 56, damping: 15, mass: 0.8 }}
      >
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : error ? { x: [0, -5, 5, -3, 0], rotate: [0, -2, 2, 0] } : success ? { y: [0, -7, 0, -4, 0], scale: [1, 1.08, 1, 1.04, 1] } : speaking ? { y: [0, -2, 0], scaleY: [1, 1.025, 1] } : thinking ? { y: [0, -3, 0], rotate: [0, 1.8, 0] } : { y: [0, -4, 0], rotate: [0, 1, 0] }}
          transition={reduceMotion ? { duration: 0.2 } : error ? { duration: 0.48 } : { duration: speaking ? 0.8 : 2.9, repeat: success || error ? 0 : Infinity, ease: "easeInOut" }}
        >
          <PesadillaAvatar
            size={76}
            active={isAnimating}
            mood={toGhostMood(visualState)}
            blink={blink}
            lookX={reduceMotion ? 0 : look.x}
            lookY={reduceMotion ? 0 : look.y}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

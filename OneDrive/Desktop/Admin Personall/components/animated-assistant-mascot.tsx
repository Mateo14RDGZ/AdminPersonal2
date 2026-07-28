"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PesadillaAvatar } from "@/components/pesadilla-avatar";
import { useMascotBrain, type MascotIntent, type MascotOrigin } from "@/components/use-mascot-brain";

export type ChatState = "closed" | "idle" | "userTyping" | "sending" | "thinking" | "streaming" | "completed" | "error" | "listening";
export type MascotState = Exclude<ChatState, "closed" | "userTyping" | "completed"> | "speaking" | "success" | "happy" | "warning" | "confused" | "sleeping" | "surprised" | "cancelled";

type AnimatedAssistantMascotProps = {
  state?: MascotState;
  isOpen: boolean;
  isUserTyping?: boolean;
  isStreaming?: boolean;
  hasError?: boolean;
  isListening?: boolean;
  inputFocused?: boolean;
  reducedMotion?: boolean;
  fullScreen?: boolean;
  className?: string;
  aiIntent?: MascotIntent | null;
  origin?: MascotOrigin | null;
  isReturning?: boolean;
};

/** Visual shell only. `useMascotBrain` owns decisions, memory, movement and attention. */
export function AnimatedAssistantMascot({
  state = "idle", isOpen, isUserTyping = false, isStreaming = false, hasError = false,
  isListening = false, inputFocused = false, reducedMotion: reducedMotionOverride,
  fullScreen = false, className = "", aiIntent, origin, isReturning = false,
}: AnimatedAssistantMascotProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(reducedMotionOverride ?? systemReducedMotion);
  const brain = useMascotBrain({ stageRef, state, isOpen, isUserTyping, isStreaming, hasError, isListening, inputFocused, aiIntent, origin, isReturning, reducedMotion });
  const small = fullScreen ? 86 : 58;

  return (
    <div ref={stageRef} className={`assistant-mascot-stage ${fullScreen ? "assistant-mascot-stage-full" : ""} ${className}`} data-behavior={brain.behavior} data-emotion={brain.emotion} data-mood={brain.mood} data-attention={brain.attention}>
      <motion.div className="assistant-mascot-particles" aria-hidden="true" style={{ opacity: brain.energy }} animate={brain.active ? { rotate: brain.behavior === "thinking" ? 360 : 0 } : { opacity: 0 }} transition={{ duration: brain.behavior === "thinking" ? 3.8 : .25, repeat: brain.behavior === "thinking" ? Infinity : 0, ease: "linear" }}><i /><i /><i /></motion.div>
      <motion.div
        className="assistant-mascot-motion"
        style={{ x: brain.x, y: brain.y, rotate: brain.rotation }}
        initial={false}
        animate={reducedMotion
          ? { opacity: 1, scale: 1 }
          : isReturning
            ? { opacity: [1, 1, .9], scale: [1, 1.055, .78] }
            : brain.behavior === "entering"
              ? { opacity: [0, 1, 1], scale: [.54, 1.11, 1] }
              : { opacity: 1, scale: 1 }}
        transition={{ duration: isReturning ? .92 : brain.behavior === "entering" ? .7 : .22, ease: "easeOut" }}
      >
        <motion.div className="assistant-mascot-flight-shape" style={{ scaleX: brain.stretchX, scaleY: brain.stretchY, skewX: brain.flightSkew }}>
          <motion.i className="assistant-mascot-flight-aura" aria-hidden="true" style={{ opacity: brain.energy }} />
          <motion.div
            animate={reducedMotion ? { opacity: 1 } : brain.behavior === "celebrating" ? { y: [0, -18, -24, -5, 0], rotate: [0, -12, 142, 356, 360], scale: [1, 1.12, 1.045, 1.02, 1] } : brain.behavior === "recovering" ? { x: [0, -5, 6, -2, 0], scale: [1, .97, 1.01, 1] } : brain.behavior === "thinking" ? { y: [0, -3, -7, -3, 0], rotate: [0, -2.4, 1.6, 0], scale: [1, .995, 1.012, 1] } : brain.behavior === "speaking" ? { y: [0, -3.5, 0, -1.5, 0], rotate: [0, 1.4, -1, 0], scale: [1, 1.018, .997, 1] } : brain.behavior === "sleeping" ? { y: [0, -2, 0], rotate: [0, .4, 0], scale: [1, .995, 1] } : { y: [0, -4, 0, -2, 0], rotate: [0, .8, -.65, 0], scale: [1, 1.015, .997, 1] }}
            transition={{ duration: brain.behavior === "celebrating" ? 1.18 : brain.behavior === "speaking" ? .76 : brain.behavior === "thinking" ? 1.36 : brain.behavior === "sleeping" ? 3.2 : 2.2, repeat: ["celebrating", "recovering"].includes(brain.behavior) || reducedMotion ? 0 : Infinity, ease: "easeInOut" }}
          >
            <PesadillaAvatar size={small} active={brain.active} mood={brain.mood} lookX={brain.lookX} lookY={brain.lookY} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

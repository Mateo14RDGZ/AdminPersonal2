"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { PesadillaAvatar, type PesadillaMood } from "@/components/pesadilla-avatar";

export type ChatState = "closed" | "idle" | "userTyping" | "sending" | "thinking" | "streaming" | "completed" | "error" | "listening";
export type EmotionalState = "neutral" | "curious" | "focused" | "confident" | "happy" | "excited" | "confused" | "frustrated" | "sleepy" | "surprised";
export type BehaviorState = "resting" | "observing" | "wandering" | "approaching" | "thinking" | "speaking" | "celebrating" | "recovering" | "sleeping";
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
};

type TargetName = "rest" | "upperLeft" | "upperRight" | "center" | "nearInput" | "lastMessage" | "response";
type Target = { name: TargetName; x: number; y: number; rotate: number; lookX: number; lookY: number };

function moodFrom(chat: ChatState, emotion: EmotionalState): PesadillaMood {
  if (chat === "error") return "error";
  if (chat === "listening" || chat === "userTyping") return "listening";
  if (chat === "thinking") return "thinking";
  if (chat === "streaming") return "speaking";
  if (chat === "completed" || emotion === "excited") return "success";
  if (emotion === "surprised") return "surprised";
  if (emotion === "frustrated") return "cancelled";
  return "idle";
}

function chooseTarget(bounds: DOMRect, keyboardOpen: boolean, name: TargetName): Target {
  const width = bounds.width;
  const horizontalRange = Math.max(68, Math.min(width * .38, width / 2 - 58));
  const safeBottom = Math.max(155, bounds.height - (keyboardOpen ? 318 : 178));
  const map: Record<TargetName, Target> = {
    rest: { name: "rest", x: -horizontalRange * .44, y: Math.min(272, safeBottom * .52), rotate: -3, lookX: .1, lookY: .2 },
    upperLeft: { name: "upperLeft", x: -horizontalRange, y: 112, rotate: -8, lookX: -.8, lookY: -.5 },
    upperRight: { name: "upperRight", x: horizontalRange, y: 136, rotate: 8, lookX: .8, lookY: -.45 },
    center: { name: "center", x: 0, y: Math.max(178, Math.min(320, safeBottom * .52)), rotate: 1, lookX: 0, lookY: .1 },
    nearInput: { name: "nearInput", x: horizontalRange * .63, y: Math.max(132, Math.min(safeBottom, 380)), rotate: 6, lookX: .2, lookY: .9 },
    lastMessage: { name: "lastMessage", x: horizontalRange * .68, y: Math.max(185, Math.min(safeBottom * .68, 360)), rotate: 5, lookX: .45, lookY: .25 },
    response: { name: "response", x: -horizontalRange * .62, y: Math.max(175, Math.min(safeBottom * .57, 330)), rotate: -5, lookX: -.4, lookY: .18 },
  };
  return map[name];
}

/** Stateful, transform-only mascot layer. It never owns pointer events or layout. */
export function AnimatedAssistantMascot({
  state = "idle",
  isOpen,
  isUserTyping = false,
  isStreaming = false,
  hasError = false,
  isListening = false,
  inputFocused = false,
  reducedMotion: reducedMotionOverride,
  fullScreen = false,
  className = "",
}: AnimatedAssistantMascotProps) {
  const motionReduced = useReducedMotion();
  const reducedMotion = Boolean(reducedMotionOverride ?? motionReduced);
  const stageRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<TargetName[]>([]);
  const timersRef = useRef<number[]>([]);
  const [visible, setVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [behavior, setBehavior] = useState<BehaviorState>("resting");
  const [emotion, setEmotion] = useState<EmotionalState>("neutral");
  const [blink, setBlink] = useState(false);

  const xTarget = useMotionValue(0);
  const yTarget = useMotionValue(0);
  const rotateTarget = useMotionValue(0);
  const flightEnergy = useMotionValue(0);
  const lookX = useMotionValue(0);
  const lookY = useMotionValue(0);
  const x = useSpring(xTarget, { stiffness: 42, damping: 15, mass: 1.08 });
  const y = useSpring(yTarget, { stiffness: 38, damping: 16, mass: 1.2 });
  const rotation = useSpring(rotateTarget, { stiffness: 70, damping: 16, mass: .85 });
  const energy = useSpring(flightEnergy, { stiffness: 120, damping: 17, mass: .55 });
  const pupilX = useSpring(lookX, { stiffness: 210, damping: 22, mass: .3 });
  const pupilY = useSpring(lookY, { stiffness: 210, damping: 22, mass: .3 });

  const chatState: ChatState = !isOpen ? "closed" : hasError ? "error" : isListening ? "listening" : isStreaming || state === "speaking" ? "streaming" : state === "cancelled" ? "error" : isUserTyping || inputFocused || state === "surprised" ? "userTyping" : state === "thinking" || state === "sending" ? "thinking" : state === "success" || state === "happy" ? "completed" : "idle";
  const active = isOpen && visible && !reducedMotion;
  // A plan waiting for the user is deliberately not a celebration.  It is a
  // focused "ready" pose; an account request is an attentive/questioning one.
  const mascotMood: PesadillaMood = state === "surprised" ? "surprised" : state === "cancelled" ? "cancelled" : state === "happy" ? "ready" : state === "warning" || state === "confused" ? "listening" : moodFrom(chatState, emotion);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((activeTimer) => activeTimer !== timer);
      callback();
    }, delay);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const moveTo = useCallback((name: TargetName, intent: BehaviorState) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const target = chooseTarget(bounds, keyboardOpen, name);
    const deltaX = target.x - xTarget.get();
    const deltaY = target.y - yTarget.get();
    const distance = Math.hypot(deltaX, deltaY);
    historyRef.current = [...historyRef.current.slice(-3), name];
    setBehavior(intent);
    lookX.set(target.lookX);
    lookY.set(target.lookY);
    animate(xTarget, target.x, { type: "spring", stiffness: 44, damping: 15, mass: 1.12 });
    animate(yTarget, target.y, { type: "spring", stiffness: 40, damping: 16, mass: 1.26 });
    animate(rotateTarget, target.rotate, { type: "spring", stiffness: 72, damping: 16, mass: .82 });
    // The face artwork must never squash. The feeling of propulsion comes
    // from the trailing aura and the lean, while the character stays intact.
    animate(flightEnergy, Math.min(1, distance / 150), { duration: .18, ease: "easeOut" });
    schedule(() => {
      animate(flightEnergy, 0, { type: "spring", stiffness: 118, damping: 14, mass: .6 });
    }, Math.min(960, Math.max(420, 360 + distance * 2.1)));
  }, [flightEnergy, keyboardOpen, lookX, lookY, rotateTarget, schedule, xTarget, yTarget]);

  useEffect(() => {
    const refresh = () => {
      setIsMobile(window.matchMedia("(max-width: 640px), (pointer: coarse)").matches);
      setVisible(!document.hidden);
      const viewport = window.visualViewport;
      setKeyboardOpen(Boolean(viewport && window.innerHeight - viewport.height > 140));
    };
    refresh();
    window.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    clearTimers();
    if (!active) {
      setBehavior("resting");
      return clearTimers;
    }
    if (state === "surprised") {
      setEmotion("surprised");
      moveTo("upperRight", "wandering");
      schedule(() => moveTo("center", "observing"), 680);
      return clearTimers;
    }
    if (state === "warning" || state === "confused") {
      setEmotion("curious");
      moveTo("nearInput", "approaching");
      return clearTimers;
    }
    if (state === "happy") {
      setEmotion("confident");
      moveTo("response", "observing");
      return clearTimers;
    }
    if (chatState === "userTyping" || chatState === "listening") {
      setEmotion("curious");
      moveTo("nearInput", "approaching");
      return clearTimers;
    }
    if (chatState === "thinking") {
      setEmotion("focused");
      moveTo("upperRight", "thinking");
      schedule(() => moveTo("center", "thinking"), 920);
      schedule(() => moveTo("upperLeft", "thinking"), 1820);
      return clearTimers;
    }
    if (chatState === "streaming") {
      setEmotion("confident");
      moveTo("response", "speaking");
      return clearTimers;
    }
    if (chatState === "completed") {
      setEmotion("excited");
      moveTo("center", "celebrating");
      schedule(() => { setEmotion("happy"); setBehavior("observing"); moveTo("rest", "observing"); }, 1100);
      return clearTimers;
    }
    if (chatState === "error") {
      setEmotion("frustrated");
      moveTo("center", "recovering");
      schedule(() => { setEmotion("neutral"); setBehavior("observing"); moveTo("rest", "observing"); }, 1700);
      return clearTimers;
    }
    setEmotion("neutral");
    moveTo("rest", "observing");
    return clearTimers;
  // Message and scroll changes must not make the character wander.  Its
  // position changes only as a consequence of an actual assistant state.
  }, [active, chatState, clearTimers, moveTo, schedule, state]);

  useEffect(() => {
    if (!active || chatState !== "idle") { setBlink(false); return; }
    let cancelled = false;
    const blinkLoop = () => {
      if (cancelled) return;
      setBlink(true);
      schedule(() => setBlink(false), 115);
      schedule(blinkLoop, 4200);
    };
    schedule(blinkLoop, 2200);
    return () => { cancelled = true; };
  }, [active, chatState, schedule]);

  useEffect(() => {
    if (!active || isMobile) return;
    const followPointer = (event: PointerEvent) => {
      const bounds = stageRef.current?.getBoundingClientRect();
      if (!bounds) return;
      lookX.set(Math.max(-1, Math.min(1, (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2))));
      lookY.set(Math.max(-1, Math.min(1, (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2))));
    };
    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => window.removeEventListener("pointermove", followPointer);
  }, [active, isMobile, lookX, lookY]);

  return (
    <div ref={stageRef} className={`assistant-mascot-stage ${fullScreen ? "assistant-mascot-stage-full" : ""} ${className}`} data-behavior={behavior} data-emotion={emotion} data-mood={mascotMood}>
      <motion.div className="assistant-mascot-particles" aria-hidden="true" animate={active ? { opacity: chatState === "thinking" ? 1 : .68, rotate: chatState === "thinking" ? 360 : 0 } : { opacity: 0 }} transition={{ duration: chatState === "thinking" ? 4.8 : .3, repeat: chatState === "thinking" ? Infinity : 0, ease: "linear" }}><i /><i /><i /></motion.div>
      <motion.div className="assistant-mascot-motion" style={{ x, y, rotate: rotation }}>
        <motion.div className="assistant-mascot-flight-shape">
          <motion.i className="assistant-mascot-flight-aura" aria-hidden="true" style={{ opacity: energy }} />
          <motion.div animate={reducedMotion ? { opacity: 1 } : mascotMood === "error" || mascotMood === "cancelled" ? { x: [0, -7, 8, -4, 0], scale: [1, .94, 1.03, 1] } : mascotMood === "success" ? { y: [0, -14, 0, -8, 0], rotate: [0, -6, 6, 0], scale: [1, 1.1, .99, 1.045, 1] } : mascotMood === "thinking" ? { y: [0, -3, -7, -3, 0], rotate: [0, -2.5, 1.5, 0], scale: [1, .995, 1.01, 1] } : mascotMood === "listening" ? { y: [0, -3, 0], rotate: [0, 2.5, 0], scale: [1, 1.025, 1] } : mascotMood === "ready" ? { y: [0, -5, 0], scale: [1, 1.04, 1] } : mascotMood === "speaking" ? { y: [0, -4, 0, -2, 0], rotate: [0, 1.5, -1, 0], scale: [1, 1.018, .995, 1] } : { y: [0, -5, 0, -2, 0], rotate: [0, .85, -.65, 0], scale: [1, 1.018, .995, 1] }} transition={{ duration: mascotMood === "speaking" ? .84 : mascotMood === "thinking" ? 1.42 : 2.45, repeat: ["success", "error", "cancelled"].includes(mascotMood) || reducedMotion ? 0 : Infinity, ease: "easeInOut" }}>
            <PesadillaAvatar size={fullScreen ? (isMobile ? 96 : 108) : 64} active={active} mood={mascotMood} blink={blink} lookX={pupilX} lookY={pupilY} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

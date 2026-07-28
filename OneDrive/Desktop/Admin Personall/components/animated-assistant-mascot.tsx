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
  messageCount?: number;
  scrollTick?: number;
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

function nextIdleTarget(recent: TargetName[]): TargetName {
  const candidates: TargetName[] = ["rest", "upperLeft", "upperRight", "center", "lastMessage", "response"];
  const available = candidates.filter((candidate) => !recent.slice(-2).includes(candidate));
  return available[Math.floor(Math.random() * available.length)] ?? "rest";
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
  messageCount = 0,
  scrollTick = 0,
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
  const stretchXTarget = useMotionValue(1);
  const stretchYTarget = useMotionValue(1);
  const skewTarget = useMotionValue(0);
  const lookX = useMotionValue(0);
  const lookY = useMotionValue(0);
  const x = useSpring(xTarget, { stiffness: 42, damping: 15, mass: 1.08 });
  const y = useSpring(yTarget, { stiffness: 38, damping: 16, mass: 1.2 });
  const rotation = useSpring(rotateTarget, { stiffness: 70, damping: 16, mass: .85 });
  const stretchX = useSpring(stretchXTarget, { stiffness: 120, damping: 16, mass: .54 });
  const stretchY = useSpring(stretchYTarget, { stiffness: 110, damping: 17, mass: .58 });
  const flightSkew = useSpring(skewTarget, { stiffness: 130, damping: 17, mass: .45 });
  const pupilX = useSpring(lookX, { stiffness: 210, damping: 22, mass: .3 });
  const pupilY = useSpring(lookY, { stiffness: 210, damping: 22, mass: .3 });

  const chatState: ChatState = !isOpen ? "closed" : hasError ? "error" : isListening ? "listening" : isStreaming || state === "speaking" ? "streaming" : state === "cancelled" ? "error" : isUserTyping || inputFocused || state === "surprised" ? "userTyping" : state === "thinking" || state === "sending" ? "thinking" : state === "success" || state === "happy" ? "completed" : "idle";
  const active = isOpen && visible && !reducedMotion;
  const mascotMood: PesadillaMood = state === "surprised" ? "surprised" : state === "cancelled" ? "cancelled" : moodFrom(chatState, emotion);

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
    const direction = deltaX === 0 ? 0 : Math.sign(deltaX);
    const travelStrength = Math.min(.12, .045 + distance / 1900);
    historyRef.current = [...historyRef.current.slice(-3), name];
    setBehavior(intent);
    lookX.set(target.lookX);
    lookY.set(target.lookY);
    animate(xTarget, target.x, { type: "spring", stiffness: 44, damping: 15, mass: 1.12 });
    animate(yTarget, target.y, { type: "spring", stiffness: 40, damping: 16, mass: 1.26 });
    animate(rotateTarget, target.rotate, { type: "spring", stiffness: 72, damping: 16, mass: .82 });
    animate(stretchXTarget, 1 + travelStrength, { type: "spring", stiffness: 155, damping: 15, mass: .36 });
    animate(stretchYTarget, 1 - travelStrength * .62, { type: "spring", stiffness: 145, damping: 16, mass: .38 });
    animate(skewTarget, direction * Math.min(5.5, 2 + distance / 55), { type: "spring", stiffness: 150, damping: 15, mass: .36 });
    schedule(() => {
      animate(stretchXTarget, 1, { type: "spring", stiffness: 118, damping: 14, mass: .6 });
      animate(stretchYTarget, 1, { type: "spring", stiffness: 118, damping: 14, mass: .6 });
      animate(skewTarget, 0, { type: "spring", stiffness: 118, damping: 14, mass: .6 });
    }, Math.min(960, Math.max(420, 360 + distance * 2.1)));
  }, [keyboardOpen, lookX, lookY, rotateTarget, schedule, skewTarget, stretchXTarget, stretchYTarget, xTarget, yTarget]);

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
      schedule(() => moveTo("upperLeft", "wandering"), 520);
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
      const orbit = () => {
        moveTo(Math.random() > .5 ? "upperLeft" : "upperRight", "thinking");
        schedule(orbit, 1800 + Math.round(Math.random() * 1300));
      };
      schedule(orbit, 1500);
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
    const wander = () => {
      const target = nextIdleTarget(historyRef.current);
      moveTo(target, "wandering");
      schedule(() => setBehavior("observing"), 900);
      schedule(wander, 2600 + Math.round(Math.random() * 2200));
    };
    moveTo("rest", "resting");
    schedule(wander, 1600);
    const sleep = () => {
      if (historyRef.current.length > 4) { setEmotion("sleepy"); setBehavior("sleeping"); moveTo("rest", "sleeping"); }
    };
    schedule(sleep, 33000);
    return clearTimers;
  }, [active, chatState, clearTimers, messageCount, moveTo, schedule, scrollTick, state]);

  useEffect(() => {
    if (!active || chatState !== "idle") { setBlink(false); return; }
    let cancelled = false;
    const blinkLoop = () => {
      if (cancelled) return;
      setBlink(true);
      schedule(() => setBlink(false), 115);
      if (Math.random() > .7) {
        schedule(() => setBlink(true), 250);
        schedule(() => setBlink(false), 365);
      }
      schedule(blinkLoop, 2900 + Math.round(Math.random() * 3200));
    };
    schedule(blinkLoop, 1300 + Math.round(Math.random() * 1300));
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
    <div ref={stageRef} className={`assistant-mascot-stage ${fullScreen ? "assistant-mascot-stage-full" : ""} ${className}`} data-behavior={behavior} data-emotion={emotion}>
      <motion.div className="assistant-mascot-particles" aria-hidden="true" animate={active ? { opacity: chatState === "thinking" ? 1 : .68, rotate: chatState === "thinking" ? 360 : 0 } : { opacity: 0 }} transition={{ duration: chatState === "thinking" ? 4.8 : .3, repeat: chatState === "thinking" ? Infinity : 0, ease: "linear" }}><i /><i /><i /></motion.div>
      <motion.div className="assistant-mascot-motion" style={{ x, y, rotate: rotation }}>
        <motion.div className="assistant-mascot-flight-shape" style={{ scaleX: stretchX, scaleY: stretchY, skewX: flightSkew }}>
          <motion.div animate={reducedMotion ? { opacity: 1 } : chatState === "error" ? { x: [0, -7, 8, -4, 0], scale: [1, .9, 1.03, 1] } : chatState === "completed" ? { y: [0, -12, 0, -7, 0], scale: [1, 1.11, .98, 1.05, 1] } : chatState === "streaming" ? { y: [0, -3, 0], scaleY: [1, 1.05, .99, 1] } : { y: [0, -5, 0, -2, 0], scaleY: [1, 1.025, .99, 1] }} transition={{ duration: chatState === "streaming" ? .72 : 2.25, repeat: chatState === "completed" || chatState === "error" || reducedMotion ? 0 : Infinity, ease: "easeInOut" }}>
            <PesadillaAvatar size={fullScreen ? (isMobile ? 96 : 108) : 64} active={active} mood={mascotMood} blink={blink} lookX={pupilX} lookY={pupilY} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

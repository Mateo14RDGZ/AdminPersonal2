"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { MascotState } from "@/components/animated-assistant-mascot";
import type { PesadillaMood } from "@/components/pesadilla-avatar";

export type MascotEmotion = "neutral" | "curious" | "focused" | "confident" | "happy" | "frustrated" | "sleepy" | "surprised";
export type MascotBehavior = "entering" | "resting" | "observing" | "approaching" | "wandering" | "thinking" | "speaking" | "celebrating" | "recovering" | "sleeping";
export type MascotAttention = "none" | "input" | "user-message" | "response" | "options" | "destination" | "error" | "upper-space";
export type MascotIntent = { emotion?: string; energy?: number; behavior?: string; intensity?: number };
export type MascotOrigin = { x: number; y: number; size: number };

type Phase = "closed" | "idle" | "typing" | "sending" | "thinking" | "streaming" | "ready" | "success" | "error" | "listening" | "warning";
type Zone = "rest" | "upper-left" | "upper-right" | "center" | "input" | "message" | "response" | "options" | "confirmation";
type Micro = "observe" | "ponder" | "listen" | "stretch" | "turn" | "rest" | "sleep";
type Move = (zone: Zone, behavior: MascotBehavior, attention: MascotAttention, energyValue: number) => void;

type BrainInput = {
  stageRef: RefObject<HTMLDivElement | null>;
  state: MascotState;
  isOpen: boolean;
  isUserTyping: boolean;
  isStreaming: boolean;
  hasError: boolean;
  isListening: boolean;
  inputFocused: boolean;
  aiIntent?: MascotIntent | null;
  origin?: MascotOrigin | null;
  isReturning?: boolean;
  reducedMotion?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function phaseFrom(input: Omit<BrainInput, "stageRef" | "aiIntent" | "reducedMotion">): Phase {
  if (!input.isOpen) return "closed";
  if (input.hasError || input.state === "cancelled") return "error";
  if (input.isListening) return "listening";
  if (input.state === "success") return "success";
  if (input.state === "happy") return "ready";
  if (input.state === "warning" || input.state === "confused") return "warning";
  if (input.isStreaming || input.state === "speaking") return "streaming";
  if (input.state === "thinking" || input.state === "sending") return "thinking";
  if (input.state === "surprised") return "sending";
  if (input.isUserTyping || input.inputFocused) return "typing";
  return "idle";
}

function sanitizeIntent(intent?: MascotIntent | null) {
  if (!intent || typeof intent !== "object") return null;
  const emotions = new Set(["neutral", "curious", "focused", "confident", "happy", "frustrated", "sleepy", "surprised"]);
  const behaviors = new Set(["resting", "observing", "wandering", "approaching", "thinking", "speaking", "celebrating", "recovering", "sleeping"]);
  return {
    emotion: emotions.has(intent.emotion ?? "") ? intent.emotion as MascotEmotion : undefined,
    behavior: behaviors.has(intent.behavior ?? "") ? intent.behavior as MascotBehavior : undefined,
    energy: typeof intent.energy === "number" ? clamp(intent.energy, 0, 1) : undefined,
    intensity: typeof intent.intensity === "number" ? clamp(intent.intensity, 0, 1) : undefined,
  };
}

function moodFor(phase: Phase, micro: Micro, emotion: MascotEmotion): PesadillaMood {
  if (phase === "listening" || phase === "typing" || phase === "warning") return "listening";
  if (phase === "sending") return "surprised";
  if (phase === "thinking") return "thinking";
  if (phase === "streaming") return "speaking";
  if (phase === "ready") return "ready";
  if (phase === "success") return "success";
  if (phase === "error") return "error";
  if (micro === "ponder") return "thinking";
  if (micro === "listen") return "listening";
  if (emotion === "surprised") return "surprised";
  return "idle";
}

function targetFor(bounds: DOMRect, zone: Zone, keyboardOpen: boolean, stage: HTMLDivElement | null) {
  const mascotHalf = Math.min(52, Math.max(38, bounds.width * .13));
  const rangeX = Math.max(50, bounds.width / 2 - mascotHalf - 28);
  const contentBottom = Math.max(160, bounds.height - (keyboardOpen ? 340 : 190));
  const middleY = clamp(contentBottom * .54, 184, 360);
  const targets: Record<Zone, { x: number; y: number; lookX: number; lookY: number; rotate: number }> = {
    rest: { x: -rangeX * .42, y: middleY, lookX: .1, lookY: .1, rotate: -3 },
    "upper-left": { x: -rangeX * .72, y: 132, lookX: -.7, lookY: -.5, rotate: -7 },
    "upper-right": { x: rangeX * .68, y: 142, lookX: .72, lookY: -.45, rotate: 7 },
    center: { x: 0, y: middleY, lookX: 0, lookY: .1, rotate: 0 },
    input: { x: rangeX * .55, y: clamp(contentBottom, 150, 398), lookX: .2, lookY: .9, rotate: 6 },
    message: { x: rangeX * .5, y: clamp(contentBottom * .66, 205, 350), lookX: .45, lookY: .22, rotate: 5 },
    response: { x: -rangeX * .5, y: clamp(contentBottom * .58, 190, 336), lookX: -.42, lookY: .2, rotate: -5 },
    options: { x: rangeX * .56, y: clamp(contentBottom * .72, 205, 410), lookX: -.35, lookY: .25, rotate: 4 },
    confirmation: { x: -rangeX * .54, y: clamp(contentBottom * .72, 205, 410), lookX: .34, lookY: .25, rotate: -4 },
  };
  const selector = zone === "message" ? '[data-mascot-target="user-message"]' : zone === "response" ? '[data-mascot-target="response"]' : zone === "input" ? '[data-mascot-target="input"]' : zone === "options" ? '[data-mascot-target="options"]' : zone === "confirmation" ? '[data-mascot-target="confirmation"]' : null;
  const matches = selector ? stage?.parentElement?.querySelectorAll<HTMLElement>(selector) : null;
  const element = matches?.length ? matches[matches.length - 1] : null;
  if (!element) return targets[zone];
  const rect = element.getBoundingClientRect();
  const targetX = clamp(rect.left - bounds.left + rect.width / 2 - bounds.width / 2, -rangeX, rangeX);
  const targetY = clamp(rect.top - bounds.top - 64, 118, contentBottom);
  // Stay close enough to acknowledge UI, but never sit over its text.
  return { ...targets[zone], x: zone === "response" ? clamp(targetX - 54, -rangeX, rangeX) : clamp(targetX + 54, -rangeX, rangeX), y: targetY, lookX: clamp((targetX - targets[zone].x) / rangeX, -1, 1), lookY: .55 };
}

/** Decision layer for Pesadilla. It only changes discrete intent, never React state per frame. */
export function useMascotBrain(input: BrainInput) {
  const reducedBySystem = useReducedMotion();
  const reducedMotion = Boolean(input.reducedMotion ?? reducedBySystem);
  const phase = phaseFrom(input);
  const intent = sanitizeIntent(input.aiIntent);
  const timers = useRef<number[]>([]);
  const moveRef = useRef<Move>(() => undefined);
  const sequence = useRef(0);
  const recent = useRef<Micro[]>([]);
  const lastInteraction = useRef(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [entered, setEntered] = useState(false);
  const [brain, setBrain] = useState({ emotion: "neutral" as MascotEmotion, behavior: "resting" as MascotBehavior, attention: "none" as MascotAttention, micro: "rest" as Micro, energy: .42, intensity: .35 });

  const xTarget = useMotionValue(0);
  const yTarget = useMotionValue(170);
  const rotateTarget = useMotionValue(0);
  const energyTarget = useMotionValue(.2);
  const stretchXTarget = useMotionValue(1);
  const stretchYTarget = useMotionValue(1);
  const skewTarget = useMotionValue(0);
  const lookXTarget = useMotionValue(0);
  const lookYTarget = useMotionValue(0);
  const x = useSpring(xTarget, { stiffness: 43, damping: 15, mass: 1.16 });
  const y = useSpring(yTarget, { stiffness: 39, damping: 16, mass: 1.27 });
  const rotation = useSpring(rotateTarget, { stiffness: 75, damping: 17, mass: .86 });
  const energy = useSpring(energyTarget, { stiffness: 110, damping: 17, mass: .65 });
  const stretchX = useSpring(stretchXTarget, { stiffness: 125, damping: 16, mass: .55 });
  const stretchY = useSpring(stretchYTarget, { stiffness: 120, damping: 17, mass: .58 });
  const flightSkew = useSpring(skewTarget, { stiffness: 125, damping: 17, mass: .5 });
  const lookX = useSpring(lookXTarget, { stiffness: 230, damping: 24, mass: .24 });
  const lookY = useSpring(lookYTarget, { stiffness: 230, damping: 24, mass: .24 });

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);
  const schedule = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current = timers.current.filter((value) => value !== timer);
      fn();
    }, delay);
    timers.current.push(timer);
  }, []);
  const move = useCallback<Move>((...args) => moveRef.current(...args), []);

  useEffect(() => {
    moveRef.current = (zone, behavior, attention, energyValue) => {
      const bounds = input.stageRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const target = targetFor(bounds, zone, keyboardOpen, input.stageRef.current);
      const deltaX = target.x - xTarget.get();
      const deltaY = target.y - yTarget.get();
      const distance = Math.hypot(deltaX, deltaY);
      lookXTarget.set(target.lookX); lookYTarget.set(target.lookY);
      animate(rotateTarget, target.rotate, { type: "spring", stiffness: 76, damping: 17, mass: .82 });
      // A short anticipatory lean is followed by a spring flight and an overshoot.
      animate(xTarget, target.x, { type: "spring", stiffness: 42, damping: 14, mass: 1.16 });
      animate(yTarget, target.y, { type: "spring", stiffness: 38, damping: 15, mass: 1.25 });
      // Ghost-like squash and drag only while travelling. The effect is
      // deliberately subtle so the approved face stays recognisable.
      const flightAmount = clamp(distance / 300, 0, 1);
      animate(stretchXTarget, 1 + flightAmount * .045, { duration: .16, ease: "easeOut" });
      animate(stretchYTarget, 1 - flightAmount * .035, { duration: .16, ease: "easeOut" });
      animate(skewTarget, clamp(-deltaX / 34, -3.5, 3.5), { duration: .16, ease: "easeOut" });
      animate(energyTarget, clamp(energyValue + distance / 340, 0, 1), { duration: .16, ease: "easeOut" });
      setBrain((current) => ({ ...current, behavior, attention, energy: clamp(energyValue + distance / 340, 0, 1) }));
      schedule(() => animate(energyTarget, energyValue, { type: "spring", stiffness: 108, damping: 16, mass: .65 }), clamp(480 + distance * 2.3, 520, 1250));
      schedule(() => {
        animate(stretchXTarget, 1, { type: "spring", stiffness: 115, damping: 15, mass: .62 });
        animate(stretchYTarget, 1, { type: "spring", stiffness: 115, damping: 16, mass: .64 });
        animate(skewTarget, 0, { type: "spring", stiffness: 120, damping: 16, mass: .56 });
      }, clamp(420 + distance * 2.1, 520, 1150));
    };
  }, [energyTarget, input.stageRef, keyboardOpen, lookXTarget, lookYTarget, rotateTarget, schedule, skewTarget, stretchXTarget, stretchYTarget, xTarget, yTarget]);

  useEffect(() => {
    lastInteraction.current = Date.now();
  }, []);

  useEffect(() => {
    clearTimers();
    if (!input.isOpen) { setEntered(false); return clearTimers; }
    const origin = input.origin;
    if (origin) {
      const stageCenterX = window.innerWidth / 2 - 21;
      xTarget.set(origin.x - stageCenterX);
      yTarget.set(Math.max(8, origin.y - 44));
      rotateTarget.set(-7);
      lookXTarget.set(.15); lookYTarget.set(-.35);
      setBrain((current) => ({ ...current, behavior: "entering", attention: "destination", energy: .66, intensity: .72 }));
    }
    const timer = window.setTimeout(() => setEntered(true), origin ? 520 : 0);
    timers.current.push(timer);
    return clearTimers;
  }, [clearTimers, input.isOpen, input.origin, lookXTarget, lookYTarget, rotateTarget, xTarget, yTarget]);

  useEffect(() => {
    if (!input.isReturning || !input.origin || !input.isOpen) return;
    clearTimers();
    const stageCenterX = window.innerWidth / 2 - 21;
    lookXTarget.set(-.2); lookYTarget.set(.65);
    setBrain((current) => ({ ...current, behavior: "recovering", attention: "destination", energy: .72, intensity: .82 }));
    animate(xTarget, input.origin.x - stageCenterX, { type: "spring", stiffness: 45, damping: 15, mass: 1.1 });
    animate(yTarget, Math.max(8, input.origin.y - 44), { type: "spring", stiffness: 41, damping: 16, mass: 1.2 });
    animate(rotateTarget, 6, { type: "spring", stiffness: 80, damping: 17 });
    animate(stretchXTarget, 1.04, { duration: .15 }); animate(stretchYTarget, .965, { duration: .15 });
    schedule(() => { animate(stretchXTarget, 1, { type: "spring", stiffness: 110, damping: 15 }); animate(stretchYTarget, 1, { type: "spring", stiffness: 110, damping: 15 }); }, 420);
    return clearTimers;
  }, [clearTimers, input.isOpen, input.isReturning, input.origin, lookXTarget, lookYTarget, rotateTarget, schedule, stretchXTarget, stretchYTarget, xTarget, yTarget]);

  useEffect(() => {
    const refresh = () => {
      setVisible(!document.hidden);
      const view = window.visualViewport;
      setKeyboardOpen(Boolean(view && window.innerHeight - view.height > 140));
    };
    refresh();
    window.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("resize", refresh); window.visualViewport?.removeEventListener("resize", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  useEffect(() => {
    if (phase !== "idle") lastInteraction.current = Date.now();
  }, [phase]);

  useEffect(() => {
    clearTimers();
    if (phase === "closed" || !visible || reducedMotion || input.isReturning || !entered) {
      setBrain({ emotion: "neutral", behavior: "resting", attention: "none", micro: "rest", energy: 0, intensity: 0 });
      return clearTimers;
    }
    const apply = (emotion: MascotEmotion, behavior: MascotBehavior, attention: MascotAttention, micro: Micro, energyValue: number, zone: Zone, intensity = .6) => {
      // Remote AI can suggest only a validated emotional intent; navigation
      // and safety remain local and cannot be directed by the model.
      const finalEmotion = intent?.emotion ?? emotion;
      const finalBehavior = intent?.behavior ?? behavior;
      const finalEnergy = intent?.energy ?? energyValue;
      const finalIntensity = intent?.intensity ?? intensity;
      setBrain({ emotion: finalEmotion, behavior: finalBehavior, attention, micro, energy: finalEnergy, intensity: finalIntensity });
      move(zone, finalBehavior, attention, finalEnergy);
    };
    if (phase === "typing") { apply("curious", "approaching", "input", "listen", .58, "input", .72); return clearTimers; }
    if (phase === "listening") { apply("curious", "approaching", "input", "listen", .72, "input", .9); return clearTimers; }
    if (phase === "sending") { apply("surprised", "observing", "user-message", "observe", .76, "message", .86); schedule(() => move("message", "observing", "user-message", .64), 360); return clearTimers; }
    if (phase === "thinking") {
      apply("focused", "thinking", "upper-space", "ponder", .68, "upper-right", .84);
      schedule(() => move("center", "thinking", "upper-space", .66), 760);
      schedule(() => move("upper-left", "thinking", "upper-space", .63), 1590);
      return clearTimers;
    }
    if (phase === "streaming") { apply("confident", "speaking", "response", "observe", .62, "response", .74); schedule(() => move("message", "speaking", "user-message", .58), 980); return clearTimers; }
    if (phase === "ready" || phase === "warning") { apply(phase === "ready" ? "confident" : "curious", "observing", phase === "warning" ? "options" : "response", "observe", .54, phase === "warning" ? "options" : "confirmation", .68); return clearTimers; }
    if (phase === "success") { apply("happy", "celebrating", "response", "observe", .95, "center", 1); schedule(() => apply("happy", "recovering", "none", "rest", .42, "rest", .46), 1200); return clearTimers; }
    if (phase === "error") { apply("frustrated", "recovering", "error", "rest", .7, "center", .9); schedule(() => apply("neutral", "recovering", "none", "rest", .32, "rest", .35), 1500); return clearTimers; }

    // Idle navigation uses a weighted fixed deck. Recently used actions are
    // skipped, so it feels varied without uncontrolled random loops.
    const chooseMicro = () => {
      const deck: Array<{ micro: Micro; zone: Zone; attention: MascotAttention; behavior: MascotBehavior; minIdle: number; duration: number }> = [
        { micro: "observe", zone: "message", attention: "user-message", behavior: "observing", minIdle: 0, duration: 3400 },
        { micro: "ponder", zone: "upper-right", attention: "upper-space", behavior: "wandering", minIdle: 0, duration: 3900 },
        { micro: "listen", zone: "input", attention: "input", behavior: "approaching", minIdle: 2500, duration: 3300 },
        { micro: "stretch", zone: "center", attention: "none", behavior: "wandering", minIdle: 5200, duration: 3600 },
        { micro: "turn", zone: "upper-left", attention: "destination", behavior: "wandering", minIdle: 7600, duration: 4100 },
        { micro: "rest", zone: "rest", attention: "none", behavior: "resting", minIdle: 0, duration: 4400 },
        { micro: "sleep", zone: "rest", attention: "none", behavior: "sleeping", minIdle: 28000, duration: 5200 },
      ];
      const idleFor = Date.now() - lastInteraction.current;
      let pick = deck[sequence.current % deck.length];
      for (let index = 0; index < deck.length; index += 1) {
        const candidate = deck[(sequence.current + index) % deck.length];
        if (idleFor >= candidate.minIdle && !recent.current.includes(candidate.micro)) { pick = candidate; break; }
      }
      sequence.current += 1;
      recent.current = [...recent.current.slice(-2), pick.micro];
      const isSleep = pick.micro === "sleep";
      setBrain({ emotion: isSleep ? "sleepy" : pick.micro === "ponder" ? "focused" : "neutral", behavior: pick.behavior, attention: pick.attention, micro: pick.micro, energy: isSleep ? .12 : .35, intensity: isSleep ? .2 : .38 });
      move(pick.zone, pick.behavior, pick.attention, isSleep ? .12 : .35);
      schedule(chooseMicro, pick.duration + (sequence.current % 3) * 430);
    };
    schedule(chooseMicro, 540);
    return clearTimers;
  }, [clearTimers, entered, input.isReturning, intent, move, phase, reducedMotion, schedule, visible]);

  useEffect(() => {
    if (phase === "closed" || !visible) return;
    const tap = (event: PointerEvent) => {
      const bounds = input.stageRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const mascotX = bounds.left + bounds.width / 2 + xTarget.get();
      const mascotY = bounds.top + yTarget.get() + 54;
      if (Math.hypot(event.clientX - mascotX, event.clientY - mascotY) > 78) return;
      lastInteraction.current = Date.now();
      lookXTarget.set(clamp((event.clientX - mascotX) / 45, -1, 1));
      lookYTarget.set(clamp((event.clientY - mascotY) / 45, -1, 1));
      setBrain((current) => ({ ...current, emotion: "surprised", behavior: "observing", attention: "destination", micro: "observe", energy: .76, intensity: .82 }));
      animate(energyTarget, .86, { duration: .12 });
      schedule(() => animate(energyTarget, .34, { type: "spring", stiffness: 100, damping: 16 }), 520);
    };
    window.addEventListener("pointerdown", tap, { passive: true });
    return () => window.removeEventListener("pointerdown", tap);
  }, [energyTarget, input.stageRef, lookXTarget, lookYTarget, phase, schedule, visible, xTarget, yTarget]);

  const mood = moodFor(phase, brain.micro, intent?.emotion ?? brain.emotion);
  return { ...brain, phase, mood, x, y, rotation, energy, stretchX, stretchY, flightSkew, lookX, lookY, active: phase !== "closed" && visible && !reducedMotion, keyboardOpen, intent };
}

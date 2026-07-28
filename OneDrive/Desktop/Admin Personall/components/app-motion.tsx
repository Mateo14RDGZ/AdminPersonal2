"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export const appMotion = {
  ease,
  micro: { duration: 0.16, ease },
  page: { duration: 0.24, ease },
  sheet: { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 },
};

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function AppPageTransition({ path, children }: { path: string; children: ReactNode }) {
  return (
    <MotionProvider>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={path}
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={appMotion.page}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionProvider>
  );
}

type BottomSheetProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  labelledBy?: string;
};

/** Shared iPhone-style sheet. It deliberately never includes the bottom navigation. */
export function BottomSheet({
  open,
  children,
  className = "",
  panelClassName = "",
  labelledBy,
}: BottomSheetProps) {
  return (
    <MotionProvider>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={`fixed inset-0 z-[70] flex items-end bg-black/45 px-2 pt-10 safe-bottom ${className}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={appMotion.micro}
            role="presentation"
          >
            <motion.div
              className={`sheet-panel mx-auto w-full max-w-[430px] rounded-t-[28px] bg-[var(--color-surface-elevated)] p-5 pb-7 ${panelClassName}`}
              initial={{ opacity: 0, y: 28, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.99 }}
              transition={appMotion.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
            >
              {children}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionProvider>
  );
}

export function LoadingReveal({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={appMotion.micro}
      >
        {children}
      </motion.div>
    </MotionProvider>
  );
}

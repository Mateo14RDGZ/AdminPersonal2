"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { IconArrowUpRight, IconBolt, IconCheck, IconMessageCircle, IconMicrophone, IconSparkles, IconX } from "@tabler/icons-react";
import { loadAccounts } from "@/lib/accounts-client";
import type { Account } from "@/lib/database.types";

type Message = { role: "assistant" | "user"; text: string };
type Action = "reply" | "register_movement" | "create_account" | "create_category" | "update_account_balance" | "delete_account" | "add_savings_plan" | "add_income_plan" | "create_card" | "create_goal" | "create_recurring_payment" | "set_category_budget";
type PlanData = { raw_text: string | null; account_id: string | null; category_id: string | null; name: string | null; institution: string | null; account_type: string | null; currency: string | null; amount: number | null; target_amount: number | null; date: string | null; color: string | null };
type Plan = { action: Action; message: string; data: PlanData };
type ConversationDraft = { action: Action | null; data: PlanData };
type Props = { onRegistered: () => void };
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const initialMessages: Message[] = [{ role: "assistant", text: "Contame qué querés organizar. Te guío y lo dejo listo para confirmar." }];
const panelEase = [0.16, 1, 0.3, 1] as const;

function normalizeAccountText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function accountMentionInText(value: string, accounts: Account[]) {
  const normalized = normalizeAccountText(value);
  if (/\b(?:efectivo|cash)\b/.test(normalized)) return accounts.find((account) => account.type === "CASH") ?? null;
  return accounts.find((account) => {
    const name = normalizeAccountText(account.name);
    const institution = account.institution ? normalizeAccountText(account.institution) : "";
    return normalized.includes(name) || (institution.length > 2 && normalized.includes(institution));
  }) ?? null;
}

export function MoneyChat({ onRegistered }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [conversationActive, setConversationActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState<ConversationDraft | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const suggestions = ["Configurar mis cuentas", "Crear una categoría", "Registrar mi sueldo"];

  useEffect(() => {
    setMounted(true);
    void loadAccounts().then(setAccounts).catch(() => undefined);
    return () => {
      recognitionRef.current?.stop();
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const closeConversation = () => {
    setConversationActive(false);
    setPlan(null);
    setText("");
    setDraft(null);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setMessages(initialMessages), 700);
  };

  const sendText = async (rawText: string) => {
    const value = rawText.trim();
    if (!value || sending) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setMessages((current) => [...current, { role: "user", text: value }]);
    setConversationActive(true);
    setText("");
    setSending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, history: messages.slice(-16), draft }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessages((current) => [...current, { role: "assistant", text: typeof data?.error === "string" ? data.error : "No pude entender ese mensaje." }]);
        return;
      }
      const nextPlan = data.plan as Plan;
      const nextDraft = data.draft as ConversationDraft | undefined;
      const resolvedDraft = nextDraft ?? { action: nextPlan.action === "reply" ? draft?.action ?? null : nextPlan.action, data: nextPlan.data };
      const availableAccounts = accounts.length ? accounts : await loadAccounts().catch(() => [] as Account[]);
      if (!accounts.length && availableAccounts.length) setAccounts(availableAccounts);
      const detectedAccount = resolvedDraft.action === "register_movement" ? accountMentionInText(value, availableAccounts) : null;
      if (detectedAccount && resolvedDraft.data.raw_text) {
        const readyPlan: Plan = {
          action: "register_movement",
          message: `Entendí: voy a registrarlo en ${detectedAccount.name}. Confirmalo para guardarlo.`,
          data: { ...resolvedDraft.data, account_id: detectedAccount.id, currency: detectedAccount.currency },
        };
        setMessages((current) => [...current, { role: "assistant", text: readyPlan.message }]);
        setPlan(readyPlan);
        setDraft({ action: "register_movement", data: readyPlan.data });
      } else {
        setMessages((current) => [...current, { role: "assistant", text: nextPlan.message }]);
        setPlan(nextPlan.action === "reply" ? null : nextPlan);
        setDraft(resolvedDraft);
      }
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "No pude conectarme. Intentá nuevamente." }]);
    } finally {
      setSending(false);
    }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    void sendText(text);
  };

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognizerWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const SpeechRecognition = recognizerWindow.SpeechRecognition ?? recognizerWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("El dictado no está disponible en este navegador. Abrí la app desde Safari en tu iPhone.");
      setConversationActive(true);
      return;
    }
    setVoiceStatus("");
    const recognition = new SpeechRecognition();
    recognition.lang = "es-UY";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      let finalTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result[0].transcript;
        if (result.isFinal) finalTranscript += result[0].transcript;
      }
      setText(transcript.trim());
      if (finalTranscript.trim()) {
        setListening(false);
        void sendText(finalTranscript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceStatus("No pude escuchar el dictado. Revisá el permiso del micrófono e intentá otra vez.");
        setConversationActive(true);
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setConversationActive(true);
    recognition.start();
  };

  const confirmPlan = async () => {
    if (!plan || sending) return;
    setSending(true);
    try {
      if (plan.action === "register_movement") {
        const response = await fetch("/api/parse-transaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: plan.data.raw_text, source: "text", timezone: "America/Montevideo", dryRun: false, defaultAccountId: plan.data.account_id, defaultCurrency: plan.data.currency ?? "UYU", idempotencyKey: crypto.randomUUID() }) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo registrar el movimiento.");
        if (data.requiresConfirmation && data.confirmationUrl) {
          window.location.assign(data.confirmationUrl);
          return;
        }
      } else {
        const response = await fetch("/api/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo completar la acción.");
      }
      onRegistered();
      window.dispatchEvent(new Event("finance-data-changed"));
      closeConversation();
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo completar la acción." }]);
    } finally {
      setSending(false);
    }
  };

  const movementNeedsAccount = Boolean(
    (draft?.action === "register_movement" || plan?.action === "register_movement") &&
    !(plan?.action === "register_movement" && plan.data.account_id)
  );

  const selectMovementAccount = (account: Account) => {
    const movementData = plan?.action === "register_movement" ? plan.data : draft?.data;
    if (!movementData?.raw_text) return;
    const readyPlan: Plan = {
      action: "register_movement",
      message: `Perfecto, lo voy a registrar en ${account.name}. Confirmalo para guardarlo.`,
      data: { ...movementData, account_id: account.id, currency: account.currency },
    };
    setMessages((current) => [...current, { role: "assistant", text: readyPlan.message }]);
    setPlan(readyPlan);
    setDraft({ action: "register_movement", data: readyPlan.data });
  };

  const composer = (expanded: boolean) => (
    <form onSubmit={send} className={`relative flex gap-2 border-t border-[var(--color-border)] bg-black/[0.012] p-3 dark:bg-white/[0.015] ${expanded ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""}`}>
      <input autoFocus={expanded} value={text} onChange={(event) => setText(event.target.value)} placeholder="Ej: gasté 500 en nafta" className="app-input min-w-0 flex-1 border-transparent bg-[var(--color-surface-elevated)] py-2.5 shadow-sm" disabled={sending} />
      <button type="button" onClick={toggleDictation} disabled={sending} className={`pressable tap-target flex shrink-0 items-center justify-center rounded-2xl border ${listening ? "animate-pulse border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-muted)]"}`} aria-label={listening ? "Detener dictado" : "Dictar mensaje"} aria-pressed={listening}><IconMicrophone size={20} /></button>
      <button type="submit" disabled={!text.trim() || sending} className="pressable tap-target flex shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-black/20 disabled:opacity-40" aria-label="Enviar mensaje"><IconArrowUpRight size={21} /></button>
    </form>
  );

  return (
    <>
      <section className="assistant-card app-card overflow-hidden">
        <div className="assistant-glow pointer-events-none absolute" aria-hidden="true" />
        <div className="relative flex items-center gap-3 px-4 py-4">
          <span className="assistant-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"><IconSparkles size={21} stroke={2.2} /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Asistente financiero</h2><span className="flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]"><IconBolt size={11} fill="currentColor" /> Listo</span></div><p className="mt-0.5 text-xs text-[var(--color-muted)]">Contame qué querés hacer; te propongo todo listo para confirmar.</p></div>
          <IconMessageCircle className="text-[var(--color-muted)]" size={20} />
        </div>
        {composer(false)}
      </section>

      {mounted ? createPortal(
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {conversationActive ? (
              <motion.section
                className="fixed inset-0 z-[80] flex flex-col bg-[var(--color-surface)]"
                initial={{ opacity: 0, clipPath: "circle(8% at 50% 93%)", scale: 0.94 }}
                animate={{ opacity: 1, clipPath: "circle(150% at 50% 93%)", scale: 1 }}
                exit={{ opacity: 0, clipPath: "circle(8% at 50% 93%)", scale: 0.94 }}
                transition={{ duration: 1.08, ease: panelEase }}
                style={{ transformOrigin: "center bottom" }}
                role="dialog"
                aria-modal="true"
                aria-label="Asistente financiero"
              >
                <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: 0.16, duration: 0.42, ease: panelEase }} className="relative flex items-center gap-3 border-b border-[var(--color-border)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
                  <span className="assistant-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"><IconSparkles size={21} stroke={2.2} /></span>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-base font-semibold">Asistente financiero</h2><span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">En conversación</span></div><p className="mt-0.5 text-xs text-[var(--color-muted)]">Entiendo lenguaje cotidiano y preparo el cambio antes de guardarlo.</p></div>
                  <button type="button" onClick={closeConversation} className="pressable tap-target flex items-center justify-center rounded-xl text-[var(--color-muted)]" aria-label="Cerrar asistente"><IconX size={21} /></button>
                </motion.header>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.46, ease: panelEase }} className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none" aria-label="Sugerencias">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendText(suggestion)} disabled={sending} className="pressable shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-muted)]">{suggestion}</button>)}</motion.div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-1" aria-live="polite">{messages.slice(-12).map((message, index) => <motion.p key={`${message.role}-${index}-${message.text}`} initial={{ opacity: 0, y: 8, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.26, ease: panelEase }} className={`w-fit max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-[var(--color-accent)] text-white" : "bg-black/[0.045] text-[var(--color-foreground)] dark:bg-white/[0.08]"}`}>{message.text}</motion.p>)}</div>
                {movementNeedsAccount ? <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.44, ease: panelEase }} className="mx-3 mb-3 rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/7 p-3"><p className="px-1 text-sm font-semibold">Elegí la cuenta</p><p className="mt-0.5 px-1 text-xs text-[var(--color-muted)]">El movimiento se guardará únicamente en la cuenta que selecciones.</p><div className="mt-3 flex flex-wrap gap-2">{accounts.map((account) => <button key={account.id} type="button" onClick={() => selectMovementAccount(account)} className="pressable min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm font-medium">{account.name}<span className="ml-1.5 text-xs text-[var(--color-muted)]">{account.currency}</span></button>)}</div></motion.div> : null}
                {listening || voiceStatus ? <p className={`px-4 pb-2 text-xs ${voiceStatus ? "text-amber-600 dark:text-amber-300" : "text-[var(--color-accent)]"}`} aria-live="polite">{listening ? "Escuchando… hablá con naturalidad." : voiceStatus}</p> : null}
                {plan ? <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.32, ease: panelEase }} className="mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 p-2"><button type="button" onClick={() => void confirmPlan()} disabled={sending} className="pressable flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 text-sm font-semibold text-white"><IconCheck size={18} /> Confirmar</button><button type="button" onClick={closeConversation} disabled={sending} className="pressable tap-target flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" aria-label="Cancelar acción"><IconX size={18} /></button></motion.div> : null}
                {composer(true)}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </MotionConfig>,
        document.body
      ) : null}
    </>
  );
}

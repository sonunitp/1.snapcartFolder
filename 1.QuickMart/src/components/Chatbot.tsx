"use client";

import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Loader2, MessageCircle, Send, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Msg = { id: string; role: Role; content: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I’m your QuickMart assistant. Ask about **order status**, **delivery**, **refunds**, or what to buy — I’ll keep answers short and clear.",
};

const GENERIC_ERROR = "Something went wrong, please try again.";

/** Typing indicator (bot is composing). */
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-500"
        aria-live="polite"
        aria-label="Assistant is typing"
      >
        <Bot className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.2} />
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
        </span>
        <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
      </div>
    </div>
  );
}

export default function Chatbot() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    if (open) scrollBottom();
  }, [messages, open, loading, scrollBottom]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/chatbot/history", { signal: ac.signal });
        const data = (await res.json().catch(() => ({}))) as {
          messages?: { role: string; content: string }[];
        };
        if (ac.signal.aborted || !res.ok || !Array.isArray(data.messages)) return;
        const restored: Msg[] = data.messages
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim()
          )
          .map((m, i) => ({
            id: `hist-${i}-${m.role}`,
            role: m.role as Role,
            content: m.content.trim(),
          }));
        if (restored.length > 0) {
          setMessages(restored);
        }
      } catch {
        if (!ac.signal.aborted) {
          /* keep default welcome */
        }
      }
    })();
    return () => ac.abort();
  }, [status, session?.user?.id]);

  if (status !== "authenticated" || !session?.user?.id) {
    return null;
  }

  const userId = session.user.id;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");

    const priorForApi = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: Msg = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId,
          messages: priorForApi,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(
          typeof data.message === "string" && data.message.trim()
            ? data.message
            : GENERIC_ERROR
        );
        return;
      }

      const reply = data.message?.trim();
      if (!reply) {
        setError(GENERIC_ERROR);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply },
      ]);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <motion.button
          type="button"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          onClick={() => setOpen(true)}
          aria-label="Open chat assistant"
        >
          <MessageCircle className="h-7 w-7" strokeWidth={2.2} />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-end bg-black/25 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chatbot-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="flex h-[min(560px,88vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-emerald-700/20 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <Bot className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <h2 id="chatbot-title" className="text-sm font-bold">
                      QuickMart Assistant
                    </h2>
                    <p className="text-xs text-emerald-50/90">
                      Orders · Delivery · Help
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 transition hover:bg-white/15"
                  aria-label="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                ref={listRef}
                className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "assistant" && (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Bot className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                    <div
                      className={`max-w-[min(88%,280px)] rounded-2xl px-3 py-2 text-sm leading-relaxed sm:max-w-[85%] ${
                        m.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "border border-neutral-100 bg-neutral-50 text-neutral-800"
                      }`}
                    >
                      <MessageBody text={m.content} isUser={m.role === "user"} />
                    </div>
                    {m.role === "user" && (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
                        <User className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                ))}
                {loading && <TypingIndicator />}
                {error && (
                  <p
                    className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-xs text-red-800"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>

              <form
                className="border-t border-neutral-100 bg-neutral-50/80 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your order, delivery…"
                    className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    disabled={loading}
                    maxLength={2000}
                    autoComplete="off"
                    aria-label="Message"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Renders **markdown-lite** bold segments for assistant copy. */
function MessageBody({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) {
          return (
            <strong key={i} className="font-semibold text-neutral-900">
              {m[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

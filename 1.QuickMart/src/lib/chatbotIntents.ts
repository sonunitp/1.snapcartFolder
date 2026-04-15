/**
 * Lightweight intent detection before calling OpenAI (keyword / phrase).
 * Extend with NLP or a classifier later if needed.
 */

export type ChatIntent = "refund" | "cancel_order" | "order_status" | "general";

const REFUND_RE = /\b(refund|money\s*back|return\s*(my\s*)?money|get\s*my\s*money)\b/i;
const CANCEL_RE =
  /\b(cancel\s*(my\s*)?order|cancel\s*delivery|stop\s*(my\s*)?order|void\s*(my\s*)?order)\b/i;
const STATUS_RE =
  /\b(order\s*status|where\s*(is|'s)\s*my\s*order|track\s*(my\s*)?order|latest\s*order|my\s*orders?\s*status|delivery\s*status)\b/i;

export function detectIntent(text: string): ChatIntent {
  const t = text.trim();
  if (!t) return "general";
  if (REFUND_RE.test(t)) return "refund";
  if (CANCEL_RE.test(t)) return "cancel_order";
  if (STATUS_RE.test(t)) return "order_status";
  return "general";
}

/**
 * Short hello-style messages — answer without OpenAI (works when API key is missing).
 */
export function isCasualGreeting(text: string): boolean {
  const t = text
    .trim()
    .replace(/[!?.…]+$/g, "")
    .trim();
  if (!t || t.length > 48) return false;
  return /^(hi+|hii+|hey+|hello+|yo|namaste|sup|good\s+(morning|afternoon|evening))$/i.test(
    t
  );
}

/** Fixed copy for sensitive flows (no LLM hallucination). */
export const STATIC_REPLIES = {
  greeting: `Hey! I’m your QuickMart assistant. Ask about **order status**, **delivery**, **refunds**, or what you’d like to shop for — I’ll keep it short.`,

  refund: `**Refund policy (QuickMart)**  
Eligible issues (wrong/missing items, quality) can be reported within **48 hours** of delivery.  
Please email **support@quickmart.in** with your **order ID** and photos if applicable. Refunds for online payments go to the original method; COD cases may be handled as **store credit** where applicable.`,

  cancelOrder: `**Cancel an order**  
In-chat cancellation isn’t available yet.  
Open **My orders**, find your order, or contact **support@quickmart.in** with your order ID — we’ll help if the order hasn’t left for delivery.`,
} as const;

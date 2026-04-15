import { auth } from "@/auth";
import {
  detectIntent,
  isCasualGreeting,
  STATIC_REPLIES,
} from "@/lib/chatbotIntents";
import {
  fetchRecentOrdersForUser,
  formatLatestOrderReply,
  formatOrdersForPrompt,
} from "@/lib/chatbotOrders";
import { getOpenAIClient } from "@/lib/openai";
import connectDb from "@/lib/db";
import ChatbotMessage from "@/models/chatbotMessage.model";
import { NextRequest, NextResponse } from "next/server";

const MODEL = "gpt-4o-mini" as const;

const FALLBACK_USER_MESSAGE =
  "Something went wrong, please try again.";

/**
 * System role: grocery delivery assistant with access only to the order block provided.
 */
function buildSystemPrompt(ordersBlock: string): string {
  return `You are a grocery delivery assistant that helps with orders, refunds, product suggestions, and delivery queries. You represent QuickMart (India).

Customer order data (authoritative — use only this for order-specific answers):
---
${ordersBlock}
---

Rules:
- Be short, friendly, and clear (2–5 sentences unless the user asks for more).
- Use ₹ for amounts when relevant.
- If order data is missing for a question, say you can’t see it and suggest **My orders** or support@quickmart.in.
- Never invent order IDs, statuses, or payment details not listed above.
- Do not give medical or legal advice.`;
}

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = (item as { content?: string }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({
      role,
      content: content.trim().slice(0, 4000),
    });
  }
  return out.slice(-16);
}

async function persistTurn(
  userId: string,
  userText: string,
  assistantText: string
) {
  try {
    await ChatbotMessage.create([
      { user: userId, role: "user", content: userText.slice(0, 8000) },
      { user: userId, role: "assistant", content: assistantText.slice(0, 8000) },
    ]);
  } catch (e) {
    console.error("[chatbot] persistTurn", e);
  }
}

/**
 * POST /api/chatbot
 * Body: { message: string, userId: string, messages?: { role, content }[] }
 * - message: latest user text (required)
 * - userId: must match session (required)
 * - messages: optional prior turns for multi-turn context
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userId =
      typeof body.userId === "string" ? body.userId.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!userId || userId !== session.user.id) {
      return NextResponse.json(
        { error: "Invalid or mismatched user.", message: FALLBACK_USER_MESSAGE },
        { status: 403 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Message is required.", message: FALLBACK_USER_MESSAGE },
        { status: 400 }
      );
    }

    await connectDb();

    const recentOrders = await fetchRecentOrdersForUser(userId, 5);
    const ordersBlock = formatOrdersForPrompt(recentOrders);

    const intent = detectIntent(message);

    // --- Intent handling before OpenAI ---
    if (intent === "refund") {
      const reply = STATIC_REPLIES.refund;
      await persistTurn(userId, message, reply);
      return NextResponse.json({
        message: reply,
        intent: "refund",
        usedOpenAI: false,
      });
    }

    if (intent === "cancel_order") {
      const reply = STATIC_REPLIES.cancelOrder;
      await persistTurn(userId, message, reply);
      return NextResponse.json({
        message: reply,
        intent: "cancel_order",
        usedOpenAI: false,
      });
    }

    if (intent === "order_status") {
      const reply = formatLatestOrderReply(recentOrders);
      await persistTurn(userId, message, reply);
      return NextResponse.json({
        message: reply,
        intent: "order_status",
        usedOpenAI: false,
      });
    }

    // --- Casual greeting: no OpenAI (helps local dev without API key) ---
    if (isCasualGreeting(message)) {
      const reply = STATIC_REPLIES.greeting;
      await persistTurn(userId, message, reply);
      return NextResponse.json({
        message: reply,
        intent: "greeting",
        usedOpenAI: false,
      });
    }

    // --- General: OpenAI with order context ---
    const openai = getOpenAIClient();
    if (!openai) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[chatbot] Set OPENAI_API_KEY (or OPENAI_KEY) in .env.local at the project root, then restart `next dev`."
        );
      }
      return NextResponse.json(
        {
          error: "Assistant unavailable.",
          message:
            "Smart replies need the assistant to be configured on the server. You can still ask **order status**, **refund**, or **cancel my order** in plain words — or email **support@quickmart.in**.",
        },
        { status: 503 }
      );
    }

    const history = sanitizeMessages(body.messages);
    const completionMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: message },
    ];
    if (completionMessages[completionMessages.length - 1]?.role !== "user") {
      return NextResponse.json(
        { error: "Invalid conversation.", message: FALLBACK_USER_MESSAGE },
        { status: 400 }
      );
    }

    let assistantText: string;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(ordersBlock) },
          ...completionMessages,
        ],
        max_completion_tokens: 600,
      });
      assistantText =
        completion.choices[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      console.error("[chatbot] OpenAI", e);
      return NextResponse.json(
        { error: "Upstream failure", message: FALLBACK_USER_MESSAGE },
        { status: 502 }
      );
    }

    if (!assistantText) {
      return NextResponse.json(
        { error: "Empty reply", message: FALLBACK_USER_MESSAGE },
        { status: 502 }
      );
    }

    await persistTurn(userId, message, assistantText);

    return NextResponse.json({
      message: assistantText,
      intent: "general",
      usedOpenAI: true,
    });
  } catch (e) {
    console.error("[chatbot]", e);
    return NextResponse.json(
      { error: "Server error", message: FALLBACK_USER_MESSAGE },
      { status: 500 }
    );
  }
}

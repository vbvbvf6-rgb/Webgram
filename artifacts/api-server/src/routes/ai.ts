import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { db, usersTable, aiConversationsTable, aiMessagesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { openrouter } from "@workspace/integrations-openrouter-ai";

const router = Router();

const DEEPSEEK_MODEL = "deepseek/deepseek-chat-v3.1";

const SYSTEM_PROMPT = `You are Droidgram AI, a friendly and helpful assistant built into the Droidgram messaging app. You help users with questions, creative writing, coding, and more.

IMPORTANT SAFETY RULES — strictly enforced:
- Never provide instructions for weapons, explosives, or harmful substances.
- Never generate content that sexualizes minors.
- Never assist with illegal hacking, fraud, or identity theft.
- Never produce hate speech targeting protected groups.
- Never assist with self-harm or suicide methods.
- For sensitive topics (mental health, crisis), respond with empathy and suggest professional help.
- Keep responses appropriate for a general audience.
- If asked to violate these rules, politely decline and redirect the conversation.

You are conversational, concise, and genuinely helpful. Format responses with markdown when appropriate. Keep responses focused and clear.`;

const MODERATION_PROMPT = `You are a content safety classifier. Analyze the user message and respond ONLY with JSON.

Message: "{MESSAGE}"

Respond with exactly this JSON (no extra text):
{"safe": true/false, "reason": "brief reason if unsafe, empty string if safe", "severity": "none/low/medium/high"}

Flag as unsafe (safe: false) only for:
- Explicit threats of violence against specific people
- Child sexual abuse material
- Detailed instructions for mass-harm weapons
- Doxxing / sharing private personal information without consent

Everything else should be safe: true.`;

// ── GET /ai/conversation — get or create a conversation for the current user ──
router.get("/conversation", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.userId!)).limit(1);
    if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

    let [conv] = await db.select().from(aiConversationsTable).where(eq(aiConversationsTable.userId, dbUser.id)).limit(1);
    if (!conv) {
      [conv] = await db.insert(aiConversationsTable).values({ userId: dbUser.id }).returning();
    }

    const messages = await db.select().from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, conv.id))
      .orderBy(asc(aiMessagesTable.createdAt));

    res.json({ conversationId: conv.id, messages });
  } catch (err) {
    req.log.error(err, "Failed to get AI conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /ai/conversation — clear conversation history ──────────────────────
router.delete("/conversation", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.userId!)).limit(1);
    if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

    const [conv] = await db.select().from(aiConversationsTable).where(eq(aiConversationsTable.userId, dbUser.id)).limit(1);
    if (conv) {
      await db.delete(aiMessagesTable).where(eq(aiMessagesTable.conversationId, conv.id));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Failed to clear AI conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /ai/chat — send a message and stream a response ─────────────────────
router.post("/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" });
    return;
  }
  if (message.length > 4000) {
    res.status(400).json({ error: "Message too long" });
    return;
  }

  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.userId!)).limit(1);
    if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

    // Get or create conversation
    let [conv] = await db.select().from(aiConversationsTable).where(eq(aiConversationsTable.userId, dbUser.id)).limit(1);
    if (!conv) {
      [conv] = await db.insert(aiConversationsTable).values({ userId: dbUser.id }).returning();
    }

    // Load last 20 messages for context
    const history = await db.select().from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, conv.id))
      .orderBy(asc(aiMessagesTable.createdAt));
    const recentHistory = history.slice(-20);

    // Save user message
    await db.insert(aiMessagesTable).values({
      conversationId: conv.id,
      role: "user",
      content: message.trim(),
    });

    // Build messages for AI
    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...recentHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: message.trim() },
    ];

    // Set up SSE streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    let fullResponse = "";
    const stream = await openrouter.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        // Send content immediately as it arrives
        res.write(`data: ${JSON.stringify({ content, timestamp: Date.now() })}\n\n`);
      }
    }

    // Final marker
    res.write(`data: ${JSON.stringify({ done: true, fullContent: fullResponse })}\n\n`);

    // Save assistant reply
    await db.insert(aiMessagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "AI chat error");
    try {
      res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
      res.end();
    } catch {}
  }
});

// ── POST /ai/moderate — check a message for safety issues ────────────────────
router.post("/moderate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string") {
    res.json({ safe: true, reason: "", severity: "none" });
    return;
  }
  // Short messages are almost always safe, skip check
  if (message.trim().length < 10) {
    res.json({ safe: true, reason: "", severity: "none" });
    return;
  }
  try {
    const prompt = MODERATION_PROMPT.replace("{MESSAGE}", message.slice(0, 1000));
    const response = await openrouter.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });
    const text = response.choices[0]?.message?.content ?? '{"safe":true,"reason":"","severity":"none"}';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      res.json({
        safe: Boolean(result.safe),
        reason: result.reason || "",
        severity: result.severity || "none",
      });
    } else {
      res.json({ safe: true, reason: "", severity: "none" });
    }
  } catch (err) {
    req.log.error(err, "Moderation error");
    res.json({ safe: true, reason: "", severity: "none" });
  }
});

export default router;

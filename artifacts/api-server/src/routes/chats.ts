import { Router } from "express";
import { db, usersTable, chatsTable, chatMembersTable, messagesTable } from "@workspace/db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureUser } from "./users";

const router = Router();

// ── In-memory stores (ephemeral) ──────────────────────────────────────────────
const typingStore = new Map<number, Map<number, { name: string; expiresAt: number }>>();
const pinnedMessages = new Map<number, number>(); // chatId → messageId

setInterval(() => {
  const now = Date.now();
  typingStore.forEach((users, chatId) => {
    users.forEach((data, userId) => { if (data.expiresAt < now) users.delete(userId); });
    if (users.size === 0) typingStore.delete(chatId);
  });
}, 10_000);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getChatWithDetails(chatId: number, currentUserId: number) {
  const chat = await db.query.chatsTable.findFirst({ where: eq(chatsTable.id, chatId) });
  if (!chat) return null;

  const memberRows = await db
    .select({ userId: chatMembersTable.userId })
    .from(chatMembersTable)
    .where(eq(chatMembersTable.chatId, chatId));

  const memberIds = memberRows.map((m) => m.userId);
  const members = memberIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, memberIds))
    : [];

  const [lastMessage] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.chatId, chatId), eq(messagesTable.isDeleted, false)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  let lastMessageWithSender = null;
  if (lastMessage) {
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, lastMessage.senderId) });
    lastMessageWithSender = {
      ...lastMessage,
      reactions: lastMessage.reactions as Record<string, number[]>,
      readBy: lastMessage.readBy as number[],
      sender: sender!,
    };
  }

  const readByArray = (lastMessage?.readBy as number[]) || [];
  const unreadCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.chatId, chatId), eq(messagesTable.isDeleted, false)))
    .then((rows) => {
      const total = Number(rows[0]?.count || 0);
      return readByArray.includes(currentUserId) ? 0 : total;
    });

  return { ...chat, members, lastMessage: lastMessageWithSender, unreadCount };
}

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    const memberRows = await db.select({ chatId: chatMembersTable.chatId }).from(chatMembersTable).where(eq(chatMembersTable.userId, me.id));
    const chatIds = memberRows.map((r) => r.chatId);
    const totalChats = chatIds.length;
    let totalMessages = 0, totalUnread = 0, activeChats = 0;
    if (chatIds.length > 0) {
      const msgCount = await db.select({ count: sql<number>`count(*)` }).from(messagesTable).where(and(inArray(messagesTable.chatId, chatIds), eq(messagesTable.isDeleted, false)));
      totalMessages = Number(msgCount[0]?.count || 0);
      for (const chatId of chatIds) {
        const [last] = await db.select().from(messagesTable).where(and(eq(messagesTable.chatId, chatId), eq(messagesTable.isDeleted, false))).orderBy(desc(messagesTable.createdAt)).limit(1);
        if (last) { activeChats++; const readBy = (last.readBy as number[]) || []; if (!readBy.includes(me.id)) totalUnread++; }
      }
    }
    res.json({ totalChats, totalMessages, totalUnread, activeChats });
  } catch (err) { req.log.error({ err }, "Failed to get stats"); res.status(500).json({ error: "Internal server error" }); }
});

// ── List chats ────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    const memberRows = await db.select({ chatId: chatMembersTable.chatId }).from(chatMembersTable).where(eq(chatMembersTable.userId, me.id));
    const chatIds = memberRows.map((r) => r.chatId);
    if (!chatIds.length) return res.json([]);
    const chatsWithDetails = await Promise.all(chatIds.map((id) => getChatWithDetails(id, me.id)));
    const sorted = chatsWithDetails.filter(Boolean).sort((a, b) => {
      const aTime = a!.lastMessage?.createdAt ?? a!.createdAt;
      const bTime = b!.lastMessage?.createdAt ?? b!.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    res.json(sorted);
  } catch (err) { req.log.error({ err }, "Failed to get chats"); res.status(500).json({ error: "Internal server error" }); }
});

// ── Create chat ───────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    const { type, name, memberIds } = req.body as { type: "direct" | "group"; name?: string; memberIds: number[] };
    if (type === "direct") {
      const otherUserId = memberIds.find((id) => id !== me.id) ?? memberIds[0];
      const existingMembers = await db.select({ chatId: chatMembersTable.chatId }).from(chatMembersTable).where(eq(chatMembersTable.userId, me.id));
      for (const { chatId } of existingMembers) {
        const chat = await db.query.chatsTable.findFirst({ where: eq(chatsTable.id, chatId) });
        if (chat?.type !== "direct") continue;
        const otherMember = await db.query.chatMembersTable.findFirst({ where: and(eq(chatMembersTable.chatId, chatId), eq(chatMembersTable.userId, otherUserId)) });
        if (otherMember) { const details = await getChatWithDetails(chatId, me.id); return res.status(201).json(details); }
      }
    }
    const [chat] = await db.insert(chatsTable).values({ type, name: name ?? null, createdBy: me.id }).returning();
    const allMemberIds = Array.from(new Set([me.id, ...memberIds]));
    await db.insert(chatMembersTable).values(allMemberIds.map((userId) => ({ chatId: chat.id, userId })));
    const details = await getChatWithDetails(chat.id, me.id);
    res.status(201).json(details);
  } catch (err) { req.log.error({ err }, "Failed to create chat"); res.status(500).json({ error: "Internal server error" }); }
});

// ── Get single chat ───────────────────────────────────────────────────────────
router.get("/:chatId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    const chatId = Number(req.params.chatId);
    const details = await getChatWithDetails(chatId, me.id);
    if (!details) return res.status(404).json({ error: "Chat not found" });
    res.json(details);
  } catch (err) { req.log.error({ err }, "Failed to get chat"); res.status(500).json({ error: "Internal server error" }); }
});

// ── Members ───────────────────────────────────────────────────────────────────
router.get("/:chatId/members", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const memberRows = await db.select({ userId: chatMembersTable.userId }).from(chatMembersTable).where(eq(chatMembersTable.chatId, chatId));
    const memberIds = memberRows.map((m) => m.userId);
    const members = memberIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, memberIds)) : [];
    res.json(members);
  } catch (err) { req.log.error({ err }, "Failed to get members"); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/:chatId/members", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const { userId } = req.body;
    await db.insert(chatMembersTable).values({ chatId, userId });
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    res.json(user);
  } catch (err) { req.log.error({ err }, "Failed to add member"); res.status(500).json({ error: "Internal server error" }); }
});

// ── Typing indicators ─────────────────────────────────────────────────────────
router.post("/:chatId/typing", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const me = await ensureUser(req.userId!);
    const { isTyping } = req.body as { isTyping: boolean };
    if (!typingStore.has(chatId)) typingStore.set(chatId, new Map());
    const chatTyping = typingStore.get(chatId)!;
    if (isTyping) {
      chatTyping.set(me.id, { name: me.displayName, expiresAt: Date.now() + 4000 });
    } else {
      chatTyping.delete(me.id);
    }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to update typing"); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/:chatId/typing", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const me = await ensureUser(req.userId!);
    const chatTyping = typingStore.get(chatId);
    if (!chatTyping) return res.json({ typing: [] });
    const now = Date.now();
    const typing: { userId: number; name: string }[] = [];
    chatTyping.forEach((data, userId) => {
      if (userId !== me.id && data.expiresAt > now) typing.push({ userId, name: data.name });
    });
    res.json({ typing });
  } catch (err) { req.log.error({ err }, "Failed to get typing"); res.status(500).json({ error: "Internal server error" }); }
});

// ── Pinned message ────────────────────────────────────────────────────────────
router.get("/:chatId/pin", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const msgId = pinnedMessages.get(chatId);
    if (!msgId) return res.json({ pinnedMessage: null });
    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, msgId) });
    if (!msg || msg.isDeleted) { pinnedMessages.delete(chatId); return res.json({ pinnedMessage: null }); }
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, msg.senderId) });
    res.json({ pinnedMessage: { ...msg, sender, reactions: msg.reactions as Record<string, number[]>, readBy: msg.readBy as number[] } });
  } catch (err) { req.log.error({ err }, "Failed to get pin"); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/:chatId/pin", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const { messageId } = req.body as { messageId: number | null };
    if (!messageId) { pinnedMessages.delete(chatId); return res.json({ success: true }); }
    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    pinnedMessages.set(chatId, messageId);
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to pin message"); res.status(500).json({ error: "Internal server error" }); }
});

export default router;

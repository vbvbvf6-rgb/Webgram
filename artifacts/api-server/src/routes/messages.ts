import { Router } from "express";
import { db, usersTable, messagesTable } from "@workspace/db";
import { eq, and, lt, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureUser } from "./users";

const router = Router({ mergeParams: true });

async function formatMessage(msg: typeof messagesTable.$inferSelect) {
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, msg.senderId) });
  let replyTo = null;
  if (msg.replyToId) {
    const replyMsg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, msg.replyToId) });
    if (replyMsg) {
      const replySender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, replyMsg.senderId) });
      replyTo = { ...replyMsg, reactions: replyMsg.reactions as Record<string, number[]>, readBy: replyMsg.readBy as number[], sender: replySender! };
    }
  }
  return {
    ...msg,
    reactions: msg.reactions as Record<string, number[]>,
    readBy: msg.readBy as number[],
    sender: sender!,
    replyTo,
  };
}

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const before = req.query.before ? Number(req.query.before) : undefined;

    let query = db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.chatId, chatId),
          eq(messagesTable.isDeleted, false),
          ...(before ? [lt(messagesTable.id, before)] : []),
        )
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    const messages = await query;
    const formatted = await Promise.all(messages.reverse().map(formatMessage));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to get messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const chatId = Number(req.params.chatId);
    const me = await ensureUser(req.userId!);
    const { content, type = "text", replyToId } = req.body;

    const [msg] = await db
      .insert(messagesTable)
      .values({ chatId, senderId: me.id, content, type, replyToId: replyToId ?? null, readBy: [me.id] })
      .returning();

    const formatted = await formatMessage(msg);
    res.status(201).json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:messageId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const me = await ensureUser(req.userId!);
    const { content } = req.body;

    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
    if (!msg || msg.senderId !== me.id) return res.status(403).json({ error: "Forbidden" });

    const [updated] = await db
      .update(messagesTable)
      .set({ content, isEdited: true, updatedAt: new Date() })
      .where(eq(messagesTable.id, messageId))
      .returning();

    const formatted = await formatMessage(updated);
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to edit message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:messageId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const me = await ensureUser(req.userId!);

    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
    if (!msg || msg.senderId !== me.id) return res.status(403).json({ error: "Forbidden" });

    await db
      .update(messagesTable)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(messagesTable.id, messageId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:messageId/react", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const me = await ensureUser(req.userId!);
    const { emoji } = req.body;

    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
    if (!msg) return res.status(404).json({ error: "Not found" });

    const reactions = (msg.reactions as Record<string, number[]>) || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(me.id);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1);
      if (!reactions[emoji].length) delete reactions[emoji];
    } else {
      reactions[emoji].push(me.id);
    }

    const [updated] = await db
      .update(messagesTable)
      .set({ reactions, updatedAt: new Date() })
      .where(eq(messagesTable.id, messageId))
      .returning();

    const formatted = await formatMessage(updated);
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to react to message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:messageId/read", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const me = await ensureUser(req.userId!);

    const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
    if (!msg) return res.status(404).json({ error: "Not found" });

    const readBy = (msg.readBy as number[]) || [];
    if (!readBy.includes(me.id)) {
      readBy.push(me.id);
      await db.update(messagesTable).set({ readBy }).where(eq(messagesTable.id, messageId));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark as read");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

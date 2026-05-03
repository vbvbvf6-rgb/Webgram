import { Router } from "express";
import { db, pollsTable, pollVotesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureUser } from "./users";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const chatId = Number(req.params.chatId);
    const { question, options, allowMultiple = false, anonymous = false } = req.body;
    if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Need question and at least 2 options" });
    }
    const [poll] = await db.insert(pollsTable).values({
      chatId, createdBy: user.id,
      question: question.trim(),
      options: options.map((o: string) => o.trim()).filter(Boolean),
      allowMultiple, anonymous,
    }).returning();
    res.json(poll);
  } catch (err) {
    req.log.error({ err }, "Failed to create poll");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:pollId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const pollId = Number(req.params.pollId);
    const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    const votes = await db.select({
      id: pollVotesTable.id,
      pollId: pollVotesTable.pollId,
      userId: pollVotesTable.userId,
      choices: pollVotesTable.choices,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    }).from(pollVotesTable)
      .innerJoin(usersTable, eq(pollVotesTable.userId, usersTable.id))
      .where(eq(pollVotesTable.pollId, pollId));
    const myVote = votes.find(v => v.userId === user.id);
    const optionCounts = poll.options.map((_: string, i: number) =>
      votes.filter(v => (v.choices as number[]).includes(i)).length
    );
    res.json({ ...poll, votes: poll.anonymous ? votes.map(v => ({ ...v, displayName: "Anonymous" })) : votes, optionCounts, myVote, totalVoters: votes.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get poll");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:pollId/vote", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const pollId = Number(req.params.pollId);
    const { choices } = req.body;
    if (!Array.isArray(choices) || choices.length === 0) return res.status(400).json({ error: "No choices provided" });
    const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (poll.closedAt && poll.closedAt < new Date()) return res.status(400).json({ error: "Poll is closed" });
    if (!poll.allowMultiple && choices.length > 1) return res.status(400).json({ error: "Multiple choices not allowed" });
    const existing = await db.select().from(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, user.id))).limit(1);
    if (existing.length > 0) {
      await db.update(pollVotesTable).set({ choices, updatedAt: new Date() })
        .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, user.id)));
    } else {
      await db.insert(pollVotesTable).values({ pollId, userId: user.id, choices });
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to vote");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:pollId/close", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const pollId = Number(req.params.pollId);
    const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (poll.createdBy !== user.id) return res.status(403).json({ error: "Not authorized" });
    const [updated] = await db.update(pollsTable).set({ closedAt: new Date() }).where(eq(pollsTable.id, pollId)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to close poll");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { db, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureUser } from "./users";

const router = Router();

async function ensureWallet(userId: number) {
  const existing = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [wallet] = await db.insert(walletsTable).values({ userId, balance: 100 }).returning();
  await db.insert(transactionsTable).values({
    toUserId: userId, amount: 100, type: "bonus",
    description: "Welcome bonus — 100 Pulsecoins to get you started! ⚡",
  });
  return wallet;
}

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const wallet = await ensureWallet(user.id);
    res.json({ ...wallet, username: user.username, displayName: user.displayName });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/daily", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const user = await ensureUser(req.userId!);
    const wallet = await ensureWallet(user.id);
    const now = new Date();
    if (wallet.lastDailyBonus) {
      const diff = now.getTime() - wallet.lastDailyBonus.getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        const next = new Date(wallet.lastDailyBonus.getTime() + 24 * 60 * 60 * 1000);
        res.status(400).json({ error: "Already claimed today", nextAt: next.toISOString() });
        return;
      }
    }
    const bonus = 50;
    const [updated] = await db.update(walletsTable)
      .set({ balance: wallet.balance + bonus, lastDailyBonus: now, updatedAt: now })
      .where(eq(walletsTable.userId, user.id))
      .returning();
    await db.insert(transactionsTable).values({
      toUserId: user.id, amount: bonus, type: "bonus",
      description: "Daily login bonus ⚡",
    });
    res.json({ wallet: updated, bonus });
  } catch (err) {
    req.log.error({ err }, "Failed to claim daily bonus");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/send", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const myWallet = await ensureWallet(me.id);
    const { toUserId, amount, description, chatId } = req.body;
    if (!toUserId || !amount || amount < 1) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    if (amount > myWallet.balance) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    if (toUserId === me.id) {
      res.status(400).json({ error: "Cannot send to yourself" });
      return;
    }
    const recipient = await db.select().from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!recipient.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const recipientWallet = await ensureWallet(toUserId);
    const now = new Date();
    await db.update(walletsTable).set({ balance: myWallet.balance - amount, updatedAt: now }).where(eq(walletsTable.userId, me.id));
    await db.update(walletsTable).set({ balance: recipientWallet.balance + amount, updatedAt: now }).where(eq(walletsTable.userId, toUserId));
    await db.insert(transactionsTable).values({
      fromUserId: me.id, toUserId: me.id, amount: -amount, type: "send",
      description: description || `Sent to ${recipient[0].displayName}`, chatId,
    });
    await db.insert(transactionsTable).values({
      fromUserId: me.id, toUserId, amount, type: "receive",
      description: description || `Received from ${me.displayName}`, chatId,
    });
    res.json({ success: true, newBalance: myWallet.balance - amount, recipient: recipient[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to send coins");
    res.status(500).json({ error: "Internal server error" });
  }
});

const GIFT_CATALOG: Record<string, { name: string; price: number }> = {
  rose:    { name: "Rose",       price: 25  },
  star:    { name: "Star",       price: 30  },
  fire:    { name: "Fire Heart", price: 50  },
  rocket:  { name: "Rocket",     price: 75  },
  crown:   { name: "Crown",      price: 100 },
  rainbow: { name: "Rainbow",    price: 150 },
  diamond: { name: "Diamond",    price: 200 },
  trophy:  { name: "Trophy",     price: 500 },
};

router.post("/gift", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const myWallet = await ensureWallet(me.id);
    const { toUserId, giftId, chatId } = req.body;
    const gift = GIFT_CATALOG[giftId];
    if (!gift) { res.status(400).json({ error: "Invalid gift" }); return; }
    if (!toUserId) { res.status(400).json({ error: "Invalid request" }); return; }
    if (gift.price > myWallet.balance) { res.status(400).json({ error: "Insufficient balance" }); return; }
    if (toUserId === me.id) { res.status(400).json({ error: "Cannot send to yourself" }); return; }
    const recipient = await db.select().from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!recipient.length) { res.status(404).json({ error: "User not found" }); return; }
    const now = new Date();
    await db.update(walletsTable).set({ balance: myWallet.balance - gift.price, updatedAt: now }).where(eq(walletsTable.userId, me.id));
    await db.insert(transactionsTable).values({
      fromUserId: me.id, toUserId: me.id, amount: -gift.price, type: "send",
      description: `Sent ${gift.name} gift to ${recipient[0].displayName}`, chatId,
    });
    res.json({ success: true, newBalance: myWallet.balance - gift.price, gift, recipient: recipient[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to send gift");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const txs = await db.select().from(transactionsTable)
      .where(or(eq(transactionsTable.toUserId, user.id), eq(transactionsTable.fromUserId, user.id)))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(50);
    res.json(txs);
  } catch (err) {
    req.log.error({ err }, "Failed to get transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leaderboard", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const wallets = await db.select({
      balance: walletsTable.balance,
      userId: walletsTable.userId,
      displayName: usersTable.displayName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    }).from(walletsTable)
      .innerJoin(usersTable, eq(walletsTable.userId, usersTable.id))
      .orderBy(desc(walletsTable.balance))
      .limit(20);
    res.json(wallets);
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

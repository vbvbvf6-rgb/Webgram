import { Router } from "express";
import { db, walletsTable, transactionsTable, usersTable, giftsTable } from "@workspace/db";
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
    const bonus = 50;
    const [updated] = await db.update(walletsTable)
      .set({ balance: wallet.balance + bonus, updatedAt: new Date() })
      .where(eq(walletsTable.userId, user.id))
      .returning();
    await db.insert(transactionsTable).values({
      toUserId: user.id, amount: bonus, type: "bonus",
      description: "Bonus ⚡",
    });
    res.json({ wallet: updated, bonus });
  } catch (err) {
    req.log.error({ err }, "Failed to claim bonus");
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
    
    // Atomically deduct from sender — re-fetch to avoid race condition
    const [freshWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, me.id)).limit(1);
    if (!freshWallet || freshWallet.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    
    const [updated] = await db.update(walletsTable)
      .set({ balance: freshWallet.balance - amount, updatedAt: now })
      .where(eq(walletsTable.userId, me.id))
      .returning();
    
    await db.update(walletsTable).set({ balance: recipientWallet.balance + amount, updatedAt: now }).where(eq(walletsTable.userId, toUserId));
    await db.insert(transactionsTable).values({
      fromUserId: me.id, toUserId: me.id, amount: -amount, type: "send",
      description: description || `Sent to ${recipient[0].displayName}`, chatId,
    });
    await db.insert(transactionsTable).values({
      fromUserId: me.id, toUserId, amount, type: "receive",
      description: description || `Received from ${me.displayName}`, chatId,
    });
    res.json({ success: true, newBalance: updated.balance, recipient: recipient[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to send coins");
    res.status(500).json({ error: "Internal server error" });
  }
});

const GIFT_CATALOG: Record<string, { name: string; price: number }> = {
  heart:        { name: "Heart",         price: 15    },
  candy:        { name: "Candy",         price: 20    },
  rose:         { name: "Rose",          price: 25    },
  star:         { name: "Star",          price: 30    },
  cake:         { name: "Cake",          price: 35    },
  teddy:        { name: "Teddy Bear",    price: 45    },
  fire:         { name: "Fire Heart",    price: 50    },
  butterfly:    { name: "Butterfly",     price: 60    },
  bear:         { name: "Bear",          price: 70    },
  rocket:       { name: "Rocket",        price: 75    },
  snowflake:    { name: "Snowflake",     price: 80    },
  unicorn:      { name: "Unicorn",       price: 90    },
  crown:        { name: "Crown",         price: 100   },
  rainbow:      { name: "Rainbow",       price: 120   },
  magic:        { name: "Magic",         price: 150   },
  ninja:        { name: "Ninja",         price: 175   },
  diamond:      { name: "Diamond",       price: 200   },
  crystal:      { name: "Crystal Ball",  price: 250   },
  dragon:       { name: "Dragon",        price: 350   },
  galaxy:       { name: "Galaxy",        price: 450   },
  trophy:       { name: "Trophy",        price: 500   },
  alien:        { name: "Alien",         price: 700   },
  nazar:        { name: "Nazar Amulet",  price: 1000  },
  infinity:     { name: "Infinity",      price: 2500  },
  universe:     { name: "Universe",      price: 5000  },
  "crown-jewel": { name: "Crown Jewel",  price: 10000 },
  godmode:      { name: "God Mode",      price: 25000 },
};

router.post("/gift", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const { toUserId, giftId, chatId, message } = req.body as { toUserId: number; giftId: string; chatId?: number; message?: string };
    const gift = GIFT_CATALOG[giftId];
    if (!gift) { res.status(400).json({ error: "Invalid gift" }); return; }
    if (!toUserId) { res.status(400).json({ error: "Invalid request" }); return; }
    const recipient = await db.select().from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!recipient.length) { res.status(404).json({ error: "User not found" }); return; }
    
    const now = new Date();
    // Fetch fresh wallet to check balance and avoid race condition
    const [freshWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, me.id)).limit(1);
    if (!freshWallet || freshWallet.balance < gift.price) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    
    // Atomically deduct balance AND save gift (transaction-like safety)
    const [updated] = await db.update(walletsTable)
      .set({ balance: freshWallet.balance - gift.price, updatedAt: now })
      .where(eq(walletsTable.userId, me.id))
      .returning();
    
    // Only record transaction and save gift if wallet update succeeded
    try {
      await db.insert(transactionsTable).values({
        fromUserId: me.id, toUserId: me.id, amount: -gift.price, type: "send",
        description: `Sent ${gift.name} gift to ${recipient[0].displayName}`, chatId,
      });
      await db.insert(transactionsTable).values({
        fromUserId: me.id, toUserId, amount: 0, type: "receive",
        description: `Received ${gift.name} gift from ${me.displayName}`, chatId,
      });
      
      // Save gift to inventory
      await db.insert(giftsTable).values({
        giftId,
        fromUserId: me.id,
        toUserId,
        currentOwnerId: toUserId,
        chatId: chatId ?? null,
        message: message?.trim() ?? null,
      });
    } catch (innerErr) {
      // If transaction or gift insert fails, rollback the balance deduction
      req.log.error({ innerErr }, "Failed to complete gift transaction, rolling back balance");
      await db.update(walletsTable)
        .set({ balance: freshWallet.balance, updatedAt: new Date() })
        .where(eq(walletsTable.userId, me.id));
      res.status(500).json({ error: "Failed to save gift. Balance refunded." });
      return;
    }
    
    res.json({ success: true, newBalance: updated.balance, gift, recipient: recipient[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to send gift");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get my gift inventory ─────────────────────────────────────────────────────
router.get("/gifts", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    const gifts = await db.select({
      id: giftsTable.id,
      giftId: giftsTable.giftId,
      message: giftsTable.message,
      createdAt: giftsTable.createdAt,
      fromUser: usersTable,
    }).from(giftsTable)
      .innerJoin(usersTable, eq(giftsTable.fromUserId, usersTable.id))
      .where(eq(giftsTable.toUserId, me.id))
      .orderBy(desc(giftsTable.createdAt))
      .limit(100);
    res.json(gifts);
  } catch (err) {
    req.log.error({ err }, "Failed to get gifts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Sell gift ─────────────────────────────────────────────────────────────────
router.post("/gift/:id/sell", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const giftId = parseInt(req.params.id);
    if (isNaN(giftId)) { res.status(400).json({ error: "Invalid gift ID" }); return; }
    
    const gift = await db.select().from(giftsTable).where(eq(giftsTable.id, giftId)).limit(1);
    if (!gift.length) { res.status(404).json({ error: "Gift not found" }); return; }
    if (gift[0].toUserId !== me.id) { res.status(403).json({ error: "You don't own this gift" }); return; }
    
    const SELL_GIFT_PRICES: Record<string, { price: number }> = {
      heart: { price: 15 }, candy: { price: 20 }, rose: { price: 25 },
      star: { price: 30 }, cake: { price: 35 }, teddy: { price: 45 },
      fire: { price: 50 }, butterfly: { price: 60 }, bear: { price: 70 },
      rocket: { price: 75 }, snowflake: { price: 80 }, unicorn: { price: 90 },
      crown: { price: 100 }, rainbow: { price: 120 }, magic: { price: 150 },
      ninja: { price: 175 }, diamond: { price: 200 }, crystal: { price: 250 },
      dragon: { price: 350 }, galaxy: { price: 450 }, trophy: { price: 500 },
      alien: { price: 700 }, nazar: { price: 1000 }, infinity: { price: 2500 },
      universe: { price: 5000 }, "crown-jewel": { price: 10000 }, godmode: { price: 25000 },
    };
    const giftInfo = SELL_GIFT_PRICES[gift[0].giftId];
    const sellPrice = Math.floor((giftInfo?.price || 0) * 0.5);
    
    const wallet = await ensureWallet(me.id);
    const [updated] = await db.update(walletsTable)
      .set({ balance: wallet.balance + sellPrice, updatedAt: new Date() })
      .where(eq(walletsTable.userId, me.id))
      .returning();
    
    await db.insert(transactionsTable).values({
      toUserId: me.id, amount: sellPrice, type: "send",
      description: `Sold ${gift[0].giftId} gift for ${sellPrice} coins`,
    });
    
    await db.delete(giftsTable).where(eq(giftsTable.id, giftId));
    res.json({ success: true, newBalance: updated.balance, sellPrice });
  } catch (err) {
    req.log.error({ err }, "Failed to sell gift");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Transfer gift to another user ──────────────────────────────────────────────
router.post("/gift/:id/transfer", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const giftId = parseInt(req.params.id);
    const { toUserId } = req.body as { toUserId: number };
    
    if (isNaN(giftId)) { res.status(400).json({ error: "Invalid gift ID" }); return; }
    if (!toUserId) { res.status(400).json({ error: "Invalid request" }); return; }
    if (toUserId === me.id) { res.status(400).json({ error: "Cannot transfer to yourself" }); return; }
    
    const gift = await db.select().from(giftsTable).where(eq(giftsTable.id, giftId)).limit(1);
    if (!gift.length) { res.status(404).json({ error: "Gift not found" }); return; }
    if (gift[0].toUserId !== me.id) { res.status(403).json({ error: "You don't own this gift" }); return; }
    
    const recipient = await db.select().from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!recipient.length) { res.status(404).json({ error: "User not found" }); return; }
    
    const [updated] = await db.update(giftsTable)
      .set({ toUserId: toUserId, updatedAt: new Date() })
      .where(eq(giftsTable.id, giftId))
      .returning();
    
    res.json({ success: true, gift: updated, recipient: recipient[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to transfer gift");
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

// ── Admin: Grant currency ────────────────────────────────────────────────────
router.post("/admin/grant", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const admin = await ensureUser(req.userId!);
    if (!admin.isAdmin) {
      res.status(403).json({ error: "Only admins can grant currency" });
      return;
    }
    
    const { toUserId, amount, description } = req.body as { toUserId: string | number; amount: number; description?: string };
    if (!toUserId || !amount || amount < 1) {
      res.status(400).json({ error: "Invalid amount (must be at least 1)" });
      return;
    }
    
    // Search by randomId (from admin panel)
    const target = await db.select().from(usersTable).where(eq(usersTable.randomId, String(toUserId))).limit(1);
    if (!target.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    const targetUserId = target[0].id;
    const targetWallet = await ensureWallet(targetUserId);
    const now = new Date();
    const [updated] = await db.update(walletsTable)
      .set({ balance: targetWallet.balance + amount, updatedAt: now })
      .where(eq(walletsTable.userId, targetUserId))
      .returning();
    
    await db.insert(transactionsTable).values({
      toUserId: targetUserId,
      amount,
      type: "bonus",
      description: description || `Admin grant by ${admin.displayName}`,
    });
    
    res.json({ success: true, newBalance: updated.balance, targetUser: target[0].displayName });
  } catch (err) {
    req.log.error({ err }, "Failed to grant currency");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sql } from "drizzle-orm";

const router = Router();

// ── In-memory public key store (ephemeral per server session) ─────────────────
// Users re-register their public key on each app load.
const pubKeyStore = new Map<number, string>();

export async function ensureUser(clerkId: string) {
  const username = `user_${clerkId.slice(-8)}`;
  const displayName = `User ${clerkId.slice(-4)}`;
  // Generate random 6-digit ID (100000-999999)
  const randomId = String(Math.floor(Math.random() * 900000) + 100000);

  const [user] = await db
    .insert(usersTable)
    .values({ clerkId, username, displayName, randomId })
    .onConflictDoUpdate({
      target: usersTable.clerkId,
      set: { clerkId: sql`excluded.clerk_id` },
    })
    .returning();
  return user;
}

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const [updated] = await db
      .update(usersTable)
      .set({ isOnline: true })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json({ ...updated, isOnline: true });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await ensureUser(req.userId!);
    const { username, displayName, bio, avatarUrl, phone, phoneVerified } = req.body;
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(username !== undefined && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(phone !== undefined && { phone }),
        ...(phoneVerified !== undefined && { phoneVerified: Boolean(phoneVerified) }),
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (!q) {
      res.json([]);
      return;
    }
    const me = await ensureUser(req.userId!);
    const results = await db
      .select()
      .from(usersTable)
      .where(
        or(
          like(usersTable.username, `%${q}%`),
          like(usersTable.displayName, `%${q}%`),
        )
      )
      .limit(20);
    res.json(results.filter((u) => u.id !== me.id));
  } catch (err) {
    req.log.error({ err }, "Failed to search users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/online", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const me = await ensureUser(req.userId!);
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.isOnline, true));
    res.json(users.filter((u) => u.id !== me.id));
  } catch (err) {
    req.log.error({ err }, "Failed to get online users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin grant (bootstrap or admin-only) ─────────────────────────────────────
router.post("/admin/grant", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await ensureUser(req.userId!);
    
    // Check if any admins exist
    const [adminCount] = await db.select({ count: sql`count(*)` }).from(usersTable).where(eq(usersTable.isAdmin, true));
    const hasAdmin = Number(adminCount?.count || 0) > 0;
    
    // Allow if no admins exist (bootstrap) or if requesting user is already admin
    if (!hasAdmin || me.isAdmin) {
      const [updated] = await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, me.id)).returning();
      res.json({ success: true, isAdmin: updated.isAdmin, message: "Admin rights granted" });
    } else {
      res.status(403).json({ error: "Only admins can grant admin rights" });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to grant admin");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── E2EE public key exchange ──────────────────────────────────────────────────

router.post("/pubkey", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const user = await ensureUser(req.userId!);
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== "string" || publicKey.length > 2048) {
      res.status(400).json({ error: "Invalid public key" });
      return;
    }
    pubKeyStore.set(user.id, publicKey);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to store public key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:randomId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.randomId, req.params.randomId)).limit(1);
    if (!user.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const u = user[0];
    res.json({
      id: u.id,
      randomId: u.randomId,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isOnline: u.isOnline,
      createdAt: u.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId/pubkey", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    const key = pubKeyStore.get(userId);
    if (!key) {
      res.status(404).json({ error: "Public key not found — user may not be online" });
      return;
    }
    res.json({ publicKey: key });
  } catch (err) {
    req.log.error({ err }, "Failed to get public key");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

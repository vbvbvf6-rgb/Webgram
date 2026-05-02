import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sql } from "drizzle-orm";

const router = Router();

export async function ensureUser(clerkId: string) {
  const username = `user_${clerkId.slice(-8)}`;
  const displayName = `User ${clerkId.slice(-4)}`;

  const [user] = await db
    .insert(usersTable)
    .values({ clerkId, username, displayName })
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
    const { username, displayName, bio, avatarUrl } = req.body;
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(username !== undefined && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
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

router.get("/online", requireAuth, async (req: AuthenticatedRequest, res) => {
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

export default router;

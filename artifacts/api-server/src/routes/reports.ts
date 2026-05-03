import { Router } from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.userId!)).limit(1);
    const { kind, title, details } = req.body as { kind: string; title: string; details: string };
    if (!kind || !title || !details) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const [report] = await db.insert(reportsTable).values({
      userId: user?.id ?? null,
      kind,
      title: title.slice(0, 200),
      details: details.slice(0, 2000),
    }).returning();
    req.log.info({ reportId: report.id, kind }, "New report submitted");
    res.json({ success: true, id: report.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

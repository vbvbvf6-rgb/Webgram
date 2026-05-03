import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;

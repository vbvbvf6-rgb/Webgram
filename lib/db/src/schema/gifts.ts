import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { chatsTable } from "./chats";

export const giftsTable = pgTable("gifts", {
  id: serial("id").primaryKey(),
  giftId: text("gift_id").notNull(),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
  toUserId: integer("to_user_id").notNull().references(() => usersTable.id),
  currentOwnerId: integer("current_owner_id").notNull().references(() => usersTable.id),
  chatId: integer("chat_id").references(() => chatsTable.id),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGiftSchema = createInsertSchema(giftsTable).omit({ id: true, createdAt: true });
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof giftsTable.$inferSelect;

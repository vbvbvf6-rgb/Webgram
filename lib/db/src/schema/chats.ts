import { pgTable, serial, text, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const chatTypeEnum = pgEnum("chat_type", ["direct", "group", "channel"]);

export const chatsTable = pgTable("chats", {
  id: serial("id").primaryKey(),
  type: chatTypeEnum("type").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMembersTable = pgTable("chat_members", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chatsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  isMuted: boolean("is_muted").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertChatSchema = createInsertSchema(chatsTable).omit({ id: true, createdAt: true });
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chatsTable.$inferSelect;

export const insertChatMemberSchema = createInsertSchema(chatMembersTable).omit({ id: true, joinedAt: true });
export type InsertChatMember = z.infer<typeof insertChatMemberSchema>;
export type ChatMember = typeof chatMembersTable.$inferSelect;

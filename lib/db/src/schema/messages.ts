import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { chatsTable } from "./chats";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "file", "system"]);

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chatsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  content: text("content"),
  type: messageTypeEnum("type").notNull().default("text"),
  replyToId: integer("reply_to_id"),
  reactions: jsonb("reactions").notNull().default({}),
  isEdited: boolean("is_edited").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  readBy: jsonb("read_by").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

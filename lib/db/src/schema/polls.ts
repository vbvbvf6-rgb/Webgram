import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { chatsTable } from "./chats";

export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chatsTable.id),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  question: text("question").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  allowMultiple: boolean("allow_multiple").notNull().default(false),
  anonymous: boolean("anonymous").notNull().default(false),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollVotesTable = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => pollsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  choices: jsonb("choices").notNull().$type<number[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPollSchema = createInsertSchema(pollsTable).omit({ id: true, createdAt: true });
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof pollsTable.$inferSelect;

export const insertPollVoteSchema = createInsertSchema(pollVotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type PollVote = typeof pollVotesTable.$inferSelect;

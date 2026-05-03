import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { chatsTable } from "./chats";

export const transactionTypeEnum = pgEnum("transaction_type", ["send", "receive", "bonus", "gift", "system"]);

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  balance: integer("balance").notNull().default(100),
  lastDailyBonus: timestamp("last_daily_bonus"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => usersTable.id),
  toUserId: integer("to_user_id").notNull().references(() => usersTable.id),
  amount: integer("amount").notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  chatId: integer("chat_id").references(() => chatsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

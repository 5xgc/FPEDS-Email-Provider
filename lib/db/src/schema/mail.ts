import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("fpeds_users", {
  id: text("id").primaryKey(),
  accessKeyHash: text("access_key_hash").notNull().unique(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  emailChangesRemaining: integer("email_changes_remaining").notNull().default(2),
  emailChangeYear: integer("email_change_year").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("fpeds_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("fpeds_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  folder: text("folder").notNull().default("inbox"),
  encryptedFrom: text("encrypted_from").notNull(),
  encryptedTo: text("encrypted_to").notNull(),
  encryptedSubject: text("encrypted_subject").notNull(),
  encryptedBody: text("encrypted_body").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  spamScore: real("spam_score").notNull().default(0),
  blocked: boolean("blocked").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const folders = pgTable("fpeds_folders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("fpeds_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  encryptedEmail: text("encrypted_email").notNull(),
  encryptedLabel: text("encrypted_label").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("fpeds_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  encryptedTitle: text("encrypted_title").notNull(),
  encryptedMessage: text("encrypted_message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users);
export const insertSessionSchema = createInsertSchema(sessions);
export const insertMessageSchema = createInsertSchema(messages);
export const insertFolderSchema = createInsertSchema(folders);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertNotificationSchema = createInsertSchema(notifications);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
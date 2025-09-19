import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callSid: text("call_sid").notNull(),
  callerNumber: text("caller_number").notNull(),
  recordingUrl: text("recording_url").notNull(),
  transcript: text("transcript"),
  score: integer("score"),
  status: text("status").notNull().default("PENDING"), // PENDING, PASS, FAIL
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  password: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).pick({
  callSid: true,
  callerNumber: true,
  recordingUrl: true,
  transcript: true,
  score: true,
  status: true,
});

export const updateSubmissionStatusSchema = z.object({
  status: z.enum(["PENDING", "PASS", "FAIL"]),
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;
export type UpdateSubmissionStatus = z.infer<typeof updateSubmissionStatusSchema>;

// User types (aliases for admin for compatibility with auth system)
export const insertUserSchema = insertAdminSchema;
export type InsertUser = InsertAdmin;
export type User = Admin;

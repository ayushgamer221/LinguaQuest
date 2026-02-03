import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // using email as username
  password: text("password").notNull(),
  displayName: text("display_name"),
  role: text("role").default("user").notNull(), // user, admin
  language: text("language").default("en").notNull(), // Target language or UI language preference
  nativeLanguage: text("native_language").default("en"),
  plan: text("plan").default("FreePack").notNull(), // FreePack, Rookie, Intermediate, Expert, Master
  xp: integer("xp").default(0).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastLoginDate: timestamp("last_login_date"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("active"), // active, canceled, past_due
  subscriptionEndDate: timestamp("subscription_end_date"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  isNewLearner: boolean("is_new_learner"),
  targetLanguage: text("target_language"), // Language user wants to learn: en, es, fr, hi
  skillLevel: text("skill_level"), // beginner, intermediate, expert, master
  dailyTimeMinutes: integer("daily_time_minutes"), // 5, 10, 15, 20, 25, 30
  referralSource: text("referral_source"), // youtuber, twitter, instagram, google, other
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown or HTML content
  difficulty: text("difficulty").notNull(), // Beginner, Intermediate, Advanced
  language: text("language").notNull(), // en, es, fr, hi
  order: integer("order").notNull(),
  quizConfig: jsonb("quiz_config"), // Array of { question, options, correctIndex }
});

export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  score: integer("score"),
  userAnswers: jsonb("user_answers"), // Array of selected answer indices
  completedAt: timestamp("completed_at").defaultNow(),
});

export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // Daily, Monthly
  description: text("description").notNull(),
  targetCount: integer("target_count").notNull(),
  rewardXp: integer("reward_xp").notNull(),
  criteria: text("criteria").notNull(), // lesson_completion, streak, quiz_score, etc.
});

export const userQuests = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  questId: integer("quest_id").notNull(),
  progress: integer("progress").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  claimed: boolean("claimed").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stripeRefundId: text("stripe_refund_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyQuizzes = pgTable("daily_quizzes", {
  id: serial("id").primaryKey(),
  quizDate: text("quiz_date").notNull(), // YYYY-MM-DD format
  difficulty: text("difficulty").notNull(), // beginner, intermediate, expert, master
  title: text("title").notNull(),
  questions: jsonb("questions").notNull(), // Array of { question, options, correctIndex }
  rewardXp: integer("reward_xp").default(25).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyQuizProgress = pgTable("daily_quiz_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  quizId: integer("quiz_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  score: integer("score"),
  userAnswers: jsonb("user_answers"),
  completedAt: timestamp("completed_at").defaultNow(),
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  xp: true, 
  streak: true, 
  lastLoginDate: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true, 
  subscriptionStatus: true,
  subscriptionEndDate: true,
  onboardingComplete: true,
  isNewLearner: true,
  targetLanguage: true,
  skillLevel: true,
  dailyTimeMinutes: true,
  referralSource: true
});

export const onboardingSchema = z.object({
  isNewLearner: z.boolean(),
  targetLanguage: z.enum(["en", "es", "fr", "hi", "de", "pt", "zh", "ja"]),
  skillLevel: z.enum(["beginner", "intermediate", "expert", "master"]),
  dailyTimeMinutes: z.number().min(5).max(30),
  referralSource: z.enum(["youtuber", "twitter", "instagram", "google", "other"])
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "hi", name: "Hindi" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" }
];

export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertQuestSchema = createInsertSchema(quests).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type Quest = typeof quests.$inferSelect;
export type UserQuest = typeof userQuests.$inferSelect;
export type DailyQuiz = typeof dailyQuizzes.$inferSelect;
export type DailyQuizProgress = typeof dailyQuizProgress.$inferSelect;

// Request/Response Types
export type LoginRequest = Pick<InsertUser, "username" | "password">;
export type RegisterRequest = InsertUser;

export type PlanType = "FreePack" | "Rookie" | "Intermediate" | "Expert" | "Master";

export const PLANS: Record<PlanType, { price: number; features: string[] }> = {
  FreePack: { price: 0, features: ["4 English lessons", "No quests", "No certificates", "Limited exercises"] },
  Rookie: { price: 4, features: ["Beginner lessons", "Daily quests", "Basic speaking exercises"] },
  Intermediate: { price: 8, features: ["All rookie features", "Grammar challenges", "Monthly quests", "Progress analytics"] },
  Expert: { price: 16, features: ["All previous features", "AI conversation practice", "Certificates", "Vocabulary trainer"] },
  Master: { price: 20, features: ["Everything unlocked", "Personal dashboard", "Advanced speaking", "Priority features"] }
};

// Re-export chat models for OpenAI integration
export * from "./models/chat";

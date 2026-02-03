import { db } from "./db";
import {
  users, lessons, quests, userQuests, lessonProgress, refunds, dailyQuizzes, dailyQuizProgress,
  type User, type InsertUser, type Lesson, type Quest, type UserQuest, type LessonProgress, type DailyQuiz, type DailyQuizProgress
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;

  // Lessons
  getLessons(difficulty?: string): Promise<Lesson[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(lesson: Lesson): Promise<Lesson>;
  
  // Progress
  updateLessonProgress(userId: number, lessonId: number, score: number, userAnswers?: number[]): Promise<LessonProgress>;
  getLessonProgress(userId: number, lessonId: number): Promise<LessonProgress | undefined>;
  getAllLessonProgress(userId: number): Promise<LessonProgress[]>;

  // Quests
  getQuests(): Promise<Quest[]>;
  getUserQuests(userId: number): Promise<UserQuest[]>;
  updateUserQuest(userId: number, questId: number, progress: number): Promise<UserQuest>;
  claimQuest(userId: number, questId: number): Promise<UserQuest>;

  // Refunds
  createRefund(userId: number, stripeRefundId: string, amount: number, reason: string): Promise<void>;

  // Daily Quizzes
  getDailyQuiz(date: string, difficulty: string): Promise<DailyQuiz | undefined>;
  getDailyQuizById(id: number): Promise<DailyQuiz | undefined>;
  getDailyQuizProgress(userId: number, quizId: number): Promise<DailyQuizProgress | undefined>;
  completeDailyQuiz(userId: number, quizId: number, score: number, userAnswers: number[]): Promise<DailyQuizProgress>;
  createDailyQuiz(quiz: Omit<DailyQuiz, 'id' | 'createdAt'>): Promise<DailyQuiz>;
  
  // Seeding
  seedUsers(): Promise<void>;
  seedLessons(): Promise<void>;
  seedQuests(): Promise<void>;
  seedDailyQuizzes(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // Lesson Methods
  async getLessons(difficulty?: string): Promise<Lesson[]> {
    if (difficulty) {
      return db.select().from(lessons).where(eq(lessons.difficulty, difficulty));
    }
    return db.select().from(lessons).orderBy(lessons.order);
  }

  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async createLesson(lesson: Lesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  // Progress Methods
  async updateLessonProgress(userId: number, lessonId: number, score: number, userAnswers?: number[]): Promise<LessonProgress> {
    const [existing] = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
    
    if (existing) {
      const [updated] = await db.update(lessonProgress)
        .set({ completed: true, score: Math.max(existing.score || 0, score), userAnswers: userAnswers || existing.userAnswers, completedAt: new Date() })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newProgress] = await db.insert(lessonProgress)
        .values({ userId, lessonId, completed: true, score, userAnswers })
        .returning();
      return newProgress;
    }
  }

  async getLessonProgress(userId: number, lessonId: number): Promise<LessonProgress | undefined> {
    const [progress] = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
    return progress;
  }

  async getAllLessonProgress(userId: number): Promise<LessonProgress[]> {
    return db.select().from(lessonProgress).where(eq(lessonProgress.userId, userId));
  }

  // Quest Methods
  async getQuests(): Promise<Quest[]> {
    return db.select().from(quests);
  }

  async getUserQuests(userId: number): Promise<UserQuest[]> {
    return db.select().from(userQuests).where(eq(userQuests.userId, userId));
  }

  async updateUserQuest(userId: number, questId: number, progress: number): Promise<UserQuest> {
    const [existing] = await db.select().from(userQuests).where(and(eq(userQuests.userId, userId), eq(userQuests.questId, questId)));
    
    if (existing) {
       const [updated] = await db.update(userQuests)
         .set({ progress, updatedAt: new Date() })
         .where(eq(userQuests.id, existing.id))
         .returning();
       return updated;
    } else {
      const [newQuest] = await db.insert(userQuests)
        .values({ userId, questId, progress })
        .returning();
      return newQuest;
    }
  }

  async claimQuest(userId: number, questId: number): Promise<UserQuest> {
    const [updated] = await db.update(userQuests)
      .set({ claimed: true, completed: true })
      .where(and(eq(userQuests.userId, userId), eq(userQuests.questId, questId)))
      .returning();
    return updated;
  }

  // Refund Methods
  async createRefund(userId: number, stripeRefundId: string, amount: number, reason: string): Promise<void> {
    await db.insert(refunds).values({ userId, stripeRefundId, amount, reason });
  }

  // Seeding
  async seedUsers() {
    // Only seed if no users
    const count = await db.select({ count: sql<number>`count(*)` }).from(users);
    if (Number(count[0].count) === 0) {
      // Create admin
      // await this.createUser({ username: "admin", password: "password", role: "admin", plan: "Master" });
    }
  }

  async seedLessons() {
    const count = await db.select({ count: sql<number>`count(*)` }).from(lessons);
    if (Number(count[0].count) === 0) {
      await db.insert(lessons).values([
        {
          title: "Introduction to Greetings",
          content: "# Greetings\n\nHello! How are you?\n\n- **Hello**: A formal greeting.\n- **Hi**: An informal greeting.",
          difficulty: "Beginner",
          language: "en",
          order: 1,
          quizConfig: [
            { question: "How do you say 'Hello' informally?", options: ["Hello", "Hi", "Good day"], correctIndex: 1 }
          ]
        },
        {
          title: "Basic Verbs",
          content: "# Verbs\n\nI eat, you eat, we eat.\n\n- **Eat**: To consume food.",
          difficulty: "Beginner",
          language: "en",
          order: 2,
          quizConfig: [
            { question: "What does 'eat' mean?", options: ["To sleep", "To consume food", "To run"], correctIndex: 1 }
          ]
        },
        {
          title: "Business English",
          content: "# Business\n\nLet's circle back to this.",
          difficulty: "Intermediate",
          language: "en",
          order: 3,
          quizConfig: []
        }
      ]);
    }
  }

  async seedQuests() {
     const count = await db.select({ count: sql<number>`count(*)` }).from(quests);
     if (Number(count[0].count) === 0) {
       await db.insert(quests).values([
         { type: "Daily", description: "Complete 1 Lesson", targetCount: 1, rewardXp: 50, criteria: "lesson_completion" },
         { type: "Daily", description: "Learn 10 Words", targetCount: 10, rewardXp: 20, criteria: "word_count" },
         { type: "Monthly", description: "7 Day Streak", targetCount: 7, rewardXp: 500, criteria: "streak" }
       ]);
     }
  }

  // Daily Quiz Methods
  async getDailyQuiz(date: string, difficulty: string): Promise<DailyQuiz | undefined> {
    const [quiz] = await db.select().from(dailyQuizzes).where(
      and(eq(dailyQuizzes.quizDate, date), eq(dailyQuizzes.difficulty, difficulty))
    );
    return quiz;
  }

  async getDailyQuizById(id: number): Promise<DailyQuiz | undefined> {
    const [quiz] = await db.select().from(dailyQuizzes).where(eq(dailyQuizzes.id, id));
    return quiz;
  }

  async getDailyQuizProgress(userId: number, quizId: number): Promise<DailyQuizProgress | undefined> {
    const [progress] = await db.select().from(dailyQuizProgress).where(
      and(eq(dailyQuizProgress.userId, userId), eq(dailyQuizProgress.quizId, quizId))
    );
    return progress;
  }

  async completeDailyQuiz(userId: number, quizId: number, score: number, userAnswers: number[]): Promise<DailyQuizProgress> {
    const existing = await this.getDailyQuizProgress(userId, quizId);
    if (existing) {
      const [updated] = await db.update(dailyQuizProgress)
        .set({ completed: true, score, userAnswers, completedAt: new Date() })
        .where(and(eq(dailyQuizProgress.userId, userId), eq(dailyQuizProgress.quizId, quizId)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(dailyQuizProgress)
      .values({ userId, quizId, completed: true, score, userAnswers })
      .returning();
    return created;
  }

  async createDailyQuiz(quiz: Omit<DailyQuiz, 'id' | 'createdAt'>): Promise<DailyQuiz> {
    const [created] = await db.insert(dailyQuizzes).values(quiz).returning();
    return created;
  }

  async seedDailyQuizzes() {
    const today = new Date().toISOString().split('T')[0];
    const difficulties = ['beginner', 'intermediate', 'expert', 'master'];
    
    for (const difficulty of difficulties) {
      const existing = await this.getDailyQuiz(today, difficulty);
      if (!existing) {
        const questions = this.generateDailyQuizQuestions(difficulty);
        await this.createDailyQuiz({
          quizDate: today,
          difficulty,
          title: `Daily ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`,
          questions,
          rewardXp: difficulty === 'beginner' ? 15 : difficulty === 'intermediate' ? 25 : difficulty === 'expert' ? 35 : 50
        });
      }
    }
  }

  private generateDailyQuizQuestions(difficulty: string) {
    const questionSets: Record<string, any[]> = {
      beginner: [
        { question: "What is the correct greeting for morning?", options: ["Good night", "Good morning", "Good afternoon", "Goodbye"], correctIndex: 1 },
        { question: "How do you say 'thank you' politely?", options: ["Thanks", "Thank you very much", "Thx", "OK"], correctIndex: 1 },
        { question: "Complete: I ___ a student.", options: ["is", "am", "are", "be"], correctIndex: 1 },
        { question: "What is the opposite of 'hot'?", options: ["Warm", "Cool", "Cold", "Freezing"], correctIndex: 2 },
        { question: "Choose the correct plural: One book, two ___", options: ["books", "bookes", "bookies", "book"], correctIndex: 0 }
      ],
      intermediate: [
        { question: "Which sentence is grammatically correct?", options: ["He don't like it", "He doesn't likes it", "He doesn't like it", "He not like it"], correctIndex: 2 },
        { question: "The meeting was ___ for 3pm.", options: ["scheduled", "scheduling", "schedule", "schedules"], correctIndex: 0 },
        { question: "She has ___ working here for five years.", options: ["be", "being", "been", "was"], correctIndex: 2 },
        { question: "Complete: If I ___ rich, I would travel the world.", options: ["am", "was", "were", "be"], correctIndex: 2 },
        { question: "Which word means 'to make something better'?", options: ["Worsen", "Improve", "Decrease", "Ignore"], correctIndex: 1 }
      ],
      expert: [
        { question: "The project manager insisted ___ completing the report by Friday.", options: ["on", "at", "for", "to"], correctIndex: 0 },
        { question: "Had I known about the traffic, I ___ earlier.", options: ["would leave", "would have left", "will leave", "had left"], correctIndex: 1 },
        { question: "The CEO's speech was so ___ that everyone felt motivated.", options: ["bored", "boring", "inspiring", "tired"], correctIndex: 2 },
        { question: "Which sentence uses the subjunctive mood correctly?", options: ["I wish I was there", "I wish I were there", "I wish I am there", "I wish I been there"], correctIndex: 1 },
        { question: "The report needs ___ before submission.", options: ["to revise", "revised", "revising", "being revised"], correctIndex: 2 }
      ],
      master: [
        { question: "The nuances of diplomatic language often ___ the uninitiated.", options: ["elude", "allude", "illude", "delude"], correctIndex: 0 },
        { question: "Which phrase demonstrates correct parallel structure?", options: ["She likes hiking, to swim, and biking", "She likes to hike, swimming, and biking", "She likes hiking, swimming, and biking", "She likes to hike, to swim, and bike"], correctIndex: 2 },
        { question: "The professor's ___ argument left no room for rebuttal.", options: ["cogent", "coagent", "contingent", "cotangent"], correctIndex: 0 },
        { question: "Complete the idiom: 'To have a chip on one's ___'", options: ["arm", "leg", "shoulder", "head"], correctIndex: 2 },
        { question: "Which word is a synonym for 'ephemeral'?", options: ["Eternal", "Transient", "Permanent", "Constant"], correctIndex: 1 }
      ]
    };
    return questionSets[difficulty] || questionSets.beginner;
  }
}

export const storage = new DatabaseStorage();

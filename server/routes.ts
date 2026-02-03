import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { onboardingSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  setupAuth(app);

  // === Lessons Routes ===
  app.get(api.lessons.list.path, async (req, res) => {
    const difficulty = req.query.difficulty as string | undefined;
    const lessons = await storage.getLessons(difficulty);
    res.json(lessons);
  });

  app.get(api.lessons.get.path, async (req, res) => {
    const lesson = await storage.getLesson(Number(req.params.id));
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    res.json(lesson);
  });

  app.post(api.lessons.complete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const { score, userAnswers } = req.body;
    const progress = await storage.updateLessonProgress(req.user!.id, Number(req.params.id), score, userAnswers);
    
    // Update XP and Streak
    const user = await storage.getUser(req.user!.id);
    if (user) {
      const newXp = user.xp + 10 + (score > 80 ? 5 : 0);
      await storage.updateUser(user.id, { xp: newXp });
    }

    res.json(progress);
  });

  // Get lesson progress for a specific lesson
  app.get("/api/lessons/:id/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const progress = await storage.getLessonProgress(req.user!.id, Number(req.params.id));
    if (!progress) return res.status(404).json({ message: "No progress found" });
    res.json(progress);
  });

  // Get all lesson progress for the user
  app.get("/api/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const progress = await storage.getAllLessonProgress(req.user!.id);
    res.json(progress);
  });

  // === Quests Routes ===
  app.get(api.quests.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const quests = await storage.getQuests();
    const userQuests = await storage.getUserQuests(req.user!.id);
    
    // Merge quest data with user progress
    const merged = quests.map(q => {
      const uq = userQuests.find(uq => uq.questId === q.id);
      return { ...q, progress: uq?.progress || 0, completed: uq?.completed || false, claimed: uq?.claimed || false };
    });
    
    res.json(merged);
  });

  app.post(api.quests.claim.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const questId = Number(req.params.id);
    
    const quest = (await storage.getQuests()).find(q => q.id === questId);
    if (!quest) {
      return res.status(404).json({ message: "Quest not found" });
    }
    
    const userQuests = await storage.getUserQuests(req.user!.id);
    const existingUserQuest = userQuests.find(uq => uq.questId === questId);
    
    if (!existingUserQuest) {
      return res.status(400).json({ message: "Quest progress not found" });
    }
    
    if (existingUserQuest.claimed) {
      return res.status(400).json({ message: "Quest already claimed" });
    }
    
    if (existingUserQuest.progress < quest.targetCount) {
      return res.status(400).json({ message: "Quest not completed yet" });
    }
    
    const result = await storage.claimQuest(req.user!.id, questId);
    
    const user = await storage.getUser(req.user!.id);
    if (user && result) {
      await storage.updateUser(user.id, { xp: user.xp + quest.rewardXp });
    }
    
    res.json(result);
  });

  // === Onboarding Route ===
  app.post(api.auth.onboarding.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid onboarding data" });
    }
    
    const { isNewLearner, targetLanguage, skillLevel, dailyTimeMinutes, referralSource } = parsed.data;
    
    const updatedUser = await storage.updateUser(req.user!.id, {
      onboardingComplete: true,
      isNewLearner,
      targetLanguage,
      skillLevel,
      dailyTimeMinutes,
      referralSource
    });
    
    res.json(updatedUser);
  });

  // === Subscription Routes (Stripe) ===
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      res.json({ publishableKey: null });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          p.active as product_active,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC
      `);

      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            active: row.product_active,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unitAmount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error: any) {
      console.error("Error fetching Stripe products:", error.message);
      res.json({ products: [] });
    }
  });

  app.post(api.subscription.createCheckout.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { plan, priceId } = req.body;

    try {
      const stripe = await getUncachableStripeClient();
      
      const user = req.user!;
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.username,
          metadata: { userId: user.id.toString() }
        });
        await storage.updateUser(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/dashboard?success=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/pricing?canceled=true`,
        metadata: { userId: user.id.toString(), plan }
      });
      
      return res.json({ url: session.url });
    } catch (e: any) {
      console.error("Stripe error:", e.message);
      return res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post(api.subscription.cancel.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    // Mock cancellation
    await storage.updateUser(req.user!.id, { subscriptionStatus: "canceled" });
    res.json({ status: "canceled" });
  });

  app.post(api.subscription.refund.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    // Check if within 72 hours
    // This logic would normally verify the subscription start date
    // For now, we allow it for the demo
    
    await storage.updateUser(req.user!.id, { subscriptionStatus: "refunded", plan: "FreePack" });
    await storage.createRefund(req.user!.id, "ref_mock_id", 0, "User requested refund");
    
    res.json({ status: "refunded" });
  });

  // === Admin Routes ===
  app.post(api.admin.createLesson.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const lesson = await storage.createLesson(req.body);
    res.status(201).json(lesson);
  });

  // === Daily Quiz Routes ===
  
  // Helper to strip correctIndex from questions for active quizzes
  function stripAnswers(quiz: any, isCompleted: boolean) {
    if (isCompleted) return quiz;
    const questions = (quiz.questions as any[]).map(q => ({
      question: q.question,
      options: q.options
    }));
    return { ...quiz, questions };
  }
  
  app.get("/api/daily-quiz", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user!;
    const today = new Date().toISOString().split('T')[0];
    const userDifficulty = user.skillLevel || "beginner";
    
    const quiz = await storage.getDailyQuiz(today, userDifficulty);
    if (!quiz) {
      return res.status(404).json({ message: "No daily quiz available for today" });
    }
    
    const progress = await storage.getDailyQuizProgress(user.id, quiz.id);
    const isCompleted = progress?.completed || false;
    
    res.json({ 
      quiz: stripAnswers(quiz, isCompleted), 
      completed: isCompleted,
      score: progress?.score,
      userAnswers: progress?.userAnswers
    });
  });

  app.get("/api/daily-quiz/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const quiz = await storage.getDailyQuizById(Number(req.params.id));
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    const progress = await storage.getDailyQuizProgress(req.user!.id, quiz.id);
    const isCompleted = progress?.completed || false;
    
    res.json({ 
      quiz: stripAnswers(quiz, isCompleted), 
      completed: isCompleted,
      score: progress?.score,
      userAnswers: progress?.userAnswers
    });
  });

  app.post("/api/daily-quiz/:id/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { userAnswers } = req.body;
    const quizId = Number(req.params.id);
    
    const quiz = await storage.getDailyQuizById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    
    const existingProgress = await storage.getDailyQuizProgress(req.user!.id, quizId);
    if (existingProgress?.completed) {
      return res.status(400).json({ message: "Quiz already completed" });
    }
    
    // Validate userAnswers
    const questions = quiz.questions as any[];
    if (!Array.isArray(userAnswers) || userAnswers.length !== questions.length) {
      return res.status(400).json({ message: "Invalid answers" });
    }
    
    // Calculate score server-side
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      if (userAnswers[i] === questions[i].correctIndex) {
        correctCount++;
      }
    }
    const score = Math.round((correctCount / questions.length) * 100);
    
    const progress = await storage.completeDailyQuiz(req.user!.id, quizId, score, userAnswers);
    
    const user = await storage.getUser(req.user!.id);
    if (user) {
      const bonusXp = score >= 80 ? 10 : 0;
      await storage.updateUser(user.id, { xp: user.xp + quiz.rewardXp + bonusXp });
    }
    
    res.json({ ...progress, score });
  });

  // === AI Tutorial Routes ===
  app.post("/api/ai/explain", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { topic, context, userLevel } = req.body;
    
    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }
    
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are a friendly English language tutor helping a ${userLevel || 'beginner'} level student. 
            Explain concepts clearly using simple language appropriate for their level.
            Use examples, analogies, and practice exercises where helpful.
            Be encouraging and supportive.`
          },
          {
            role: "user",
            content: context 
              ? `Please explain this English concept: "${topic}"\n\nContext from the lesson: ${context}`
              : `Please explain this English concept: "${topic}"`
          }
        ],
        stream: true,
        max_completion_tokens: 1024,
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("AI explain error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate explanation" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to generate explanation" });
      }
    }
  });
  
  app.post("/api/ai/practice", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { topic, userLevel } = req.body;
    
    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are an English language tutor creating practice exercises for a ${userLevel || 'beginner'} level student.
            Generate 3 practice questions/exercises for the given topic.
            Format your response as JSON with this structure:
            { "exercises": [{ "question": "...", "type": "fill-blank" | "multiple-choice" | "translation", "answer": "...", "options": ["..."] (for multiple-choice only) }] }`
          },
          {
            role: "user",
            content: `Create practice exercises for: "${topic}"`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 512,
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      res.json(JSON.parse(content));
    } catch (error) {
      console.error("AI practice error:", error);
      res.status(500).json({ message: "Failed to generate practice exercises" });
    }
  });

  // Seeding
  await storage.seedUsers();
  await storage.seedLessons();
  await storage.seedQuests();
  await storage.seedDailyQuizzes();

  return httpServer;
}

import { z } from 'zod';
import { insertUserSchema, insertLessonSchema, insertQuestSchema, users, lessons, quests, userQuests, lessonProgress, onboardingSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    onboarding: {
      method: 'POST' as const,
      path: '/api/onboarding',
      input: onboardingSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  lessons: {
    list: {
      method: 'GET' as const,
      path: '/api/lessons',
      input: z.object({ difficulty: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof lessons.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/lessons/:id',
      responses: {
        200: z.custom<typeof lessons.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/lessons/:id/complete',
      input: z.object({ score: z.number() }),
      responses: {
        200: z.custom<typeof lessonProgress.$inferSelect>(),
      },
    },
  },
  quests: {
    list: {
      method: 'GET' as const,
      path: '/api/quests',
      responses: {
        200: z.array(z.custom<typeof quests.$inferSelect & { progress?: number; completed?: boolean; claimed?: boolean }>()),
      },
    },
    claim: {
      method: 'POST' as const,
      path: '/api/quests/:id/claim',
      responses: {
        200: z.custom<typeof userQuests.$inferSelect>(),
      },
    },
  },
  subscription: {
    createCheckout: {
      method: 'POST' as const,
      path: '/api/subscription/checkout',
      input: z.object({ plan: z.string() }),
      responses: {
        200: z.object({ url: z.string() }),
      },
    },
    cancel: {
      method: 'POST' as const,
      path: '/api/subscription/cancel',
      responses: {
        200: z.object({ status: z.string() }),
      },
    },
    refund: {
      method: 'POST' as const,
      path: '/api/subscription/refund',
      responses: {
        200: z.object({ status: z.string() }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  admin: {
    createLesson: {
      method: 'POST' as const,
      path: '/api/admin/lessons',
      input: insertLessonSchema,
      responses: {
        201: z.custom<typeof lessons.$inferSelect>(),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

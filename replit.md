# LinguaQuest - English Learning Web App

## Overview
LinguaQuest is a gamified English learning platform with subscriptions, lessons, quests, and multi-language support. The app uses email/password authentication with JWT sessions and integrates with Stripe for subscription payments.

## Project Structure
```
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── auth.ts             # Authentication setup (passport + sessions)
│   ├── db.ts               # Database connection
│   ├── routes.ts           # API routes
│   └── storage.ts          # Data access layer
├── shared/                 # Shared types
│   ├── schema.ts           # Drizzle tables + Zod schemas
│   └── routes.ts           # API contract
```

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Wouter (routing), TanStack Query
- **Backend**: Node.js, Express, Passport (local strategy)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **ORM**: Drizzle ORM

## Features
- User authentication (email/password)
- **Onboarding questionnaire** for new users (5 steps: experience level, target language, skill level, daily time commitment, referral source)
- Subscription plans: FreePack, Rookie, Intermediate, Expert, Master
- Lessons grouped by difficulty (Beginner, Intermediate, Advanced) - defaults to user's skill level from onboarding
- Daily and Monthly quests with XP rewards (with duplicate claim prevention)
- Profile dashboard with streak/XP tracking
- Admin panel for lesson management

## Stripe Integration
**IMPORTANT**: The Stripe connector was not authorized. To enable payments:
1. Add your Stripe API keys as secrets:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key (sk_test_xxx or sk_live_xxx)
   - `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (pk_test_xxx or pk_live_xxx)
2. Create Stripe products/prices and update the price IDs in `server/routes.ts`

Currently, the checkout flow is mocked for demo purposes and will redirect to dashboard with success.

## Environment Variables
Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - Stripe secret API key (optional, mocked if missing)

## Database
Uses PostgreSQL with Drizzle ORM. Run migrations with:
```bash
npm run db:push
```

## Development
The app runs on port 5000. Start with:
```bash
npm run dev
```

## User Preferences
- Modern, clean UI with vibrant colors for gamification
- Mobile-first responsive design
- Multi-language UI support (EN, ES, FR, HI)

## Recent Changes
- Initial MVP implementation (February 2026)
- Email/password authentication
- Lesson system with quiz support
- Quest system with daily/monthly challenges
- Stripe subscription checkout (mocked)
- **Onboarding questionnaire** (February 2026): New users complete a 5-step questionnaire to personalize their learning experience
- **Quest claiming validation** (February 2026): Fixed duplicate claim bug - now validates quest exists, is completed, and not already claimed
- **Lessons filtering** (February 2026): Lessons page now defaults to user's selected skill level from onboarding

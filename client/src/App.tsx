import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import LessonsPage from "@/pages/lessons";
import LessonViewPage from "@/pages/lesson-view";
import QuestsPage from "@/pages/quests";
import PricingPage from "@/pages/pricing";
import ProfilePage from "@/pages/profile";
import DailyQuizPage from "@/pages/daily-quiz";
import { Skeleton } from "@/components/ui/skeleton";

function ProtectedRoute({ component: Component, requiresOnboarding = true }: { component: React.ComponentType; requiresOnboarding?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (requiresOnboarding && !user.onboardingComplete) {
    return <Redirect to="/onboarding" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {user ? (user.onboardingComplete ? <Redirect to="/dashboard" /> : <Redirect to="/onboarding" />) : <LandingPage />}
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route path="/onboarding">
        {user ? (user.onboardingComplete ? <Redirect to="/dashboard" /> : <OnboardingPage />) : <Redirect to="/auth" />}
      </Route>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/lessons">
        <ProtectedRoute component={LessonsPage} />
      </Route>
      <Route path="/lessons/:id">
        <ProtectedRoute component={LessonViewPage} />
      </Route>
      <Route path="/quests">
        <ProtectedRoute component={QuestsPage} />
      </Route>
      <Route path="/daily-quiz">
        <ProtectedRoute component={DailyQuizPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithLayout() {
  return (
    <Layout>
      <Router />
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppWithLayout />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

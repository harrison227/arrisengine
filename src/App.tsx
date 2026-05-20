import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";

// Eagerly loaded — first paint after auth lands on Dashboard.
import Dashboard from "./pages/Dashboard";

// Everything else is lazy-loaded so the main bundle stays lean.
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Content = lazy(() => import("./pages/Content"));
const Team = lazy(() => import("./pages/Team"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Settings = lazy(() => import("./pages/Settings"));
const AgencySettings = lazy(() => import("./pages/AgencySettings"));
const SavedPlans = lazy(() => import("./pages/SavedPlans"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ImageStudio = lazy(() => import("./pages/ImageStudio"));
const ContentPlanner = lazy(() => import("./pages/ContentPlanner"));
const SocialAnalytics = lazy(() => import("./pages/SocialAnalytics"));
const AIPromptStudio = lazy(() => import("./pages/AIPromptStudio"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicBrandPack = lazy(() => import("./pages/PublicBrandPack"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 minutes — prevents refetching on every mount
      gcTime: 10 * 60 * 1000,         // 10 minutes — keeps cache longer
      refetchOnWindowFocus: false,     // stops query storms on tab switch
      retry: 1,                        // reduces retry storms on errors
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/brand/:shareId" element={<PublicBrandPack />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/pipeline" element={<Pipeline />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/:id" element={<ClientDetail />} />
                    <Route path="/onboarding/:id" element={<Onboarding />} />
                    <Route
                      path="/content"
                      element={
                        <ErrorBoundary title="Content Calendar error">
                          <Content />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/image-studio" element={<ImageStudio />} />
                    <Route path="/content-planner" element={<ContentPlanner />} />
                    <Route path="/saved-plans" element={<SavedPlans />} />
                    <Route path="/social-analytics" element={<SocialAnalytics />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/agency" element={<AgencySettings />} />
                    <Route path="/settings/ai" element={<AIPromptStudio />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

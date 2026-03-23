import { lazy } from "react";
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

// Eagerly loaded pages (instant navigation)
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Content from "./pages/Content";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import AgencySettings from "./pages/AgencySettings";
import SavedPlans from "./pages/SavedPlans";

// Lazy loaded pages (heavy/rare)
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ImageStudio = lazy(() => import("./pages/ImageStudio"));
const ContentPlanner = lazy(() => import("./pages/ContentPlanner"));
const SocialAnalytics = lazy(() => import("./pages/SocialAnalytics"));
const AIPromptStudio = lazy(() => import("./pages/AIPromptStudio"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

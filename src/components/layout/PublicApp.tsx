import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load public pages
const PublicCalendarView = lazy(() => import("@/pages/PublicCalendarView"));
const PublicPlanApproval = lazy(() => import("@/pages/PublicPlanApproval"));
const PublicContractSign = lazy(() => import("@/pages/PublicContractSign"));
const PublicAnalyticsView = lazy(() => import("@/pages/PublicAnalyticsView"));

// Minimal loading fallback
const PublicPageLoader = () => (
  <div className="min-h-screen bg-slate-50 p-4 sm:p-8 flex items-center justify-center">
    <div className="max-w-md w-full space-y-4">
      <Skeleton className="h-12 w-48 mx-auto bg-slate-200" />
      <Skeleton className="h-64 w-full bg-slate-200" />
    </div>
  </div>
);

// Create a dedicated query client for public routes
const publicQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes for public data
      retry: 1,
    },
  },
});

/**
 * Minimal wrapper for public routes - NO AuthProvider, NO ThemeProvider
 * This dramatically reduces bundle size and eliminates auth initialization latency
 */
export function PublicApp() {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/view/:shareId"
            element={
              <Suspense fallback={<PublicPageLoader />}>
                <PublicCalendarView />
              </Suspense>
            }
          />
          <Route
            path="/public/calendar/:shareId"
            element={
              <Suspense fallback={<PublicPageLoader />}>
                <PublicCalendarView />
              </Suspense>
            }
          />
          <Route
            path="/approve/:shareId"
            element={
              <Suspense fallback={<PublicPageLoader />}>
                <PublicPlanApproval />
              </Suspense>
            }
          />
          <Route
            path="/contract/:shareId"
            element={
              <Suspense fallback={<PublicPageLoader />}>
                <PublicContractSign />
              </Suspense>
            }
          />
          <Route
            path="/analytics/:shareId"
            element={
              <Suspense fallback={<PublicPageLoader />}>
                <PublicAnalyticsView />
              </Suspense>
            }
          />
          {/* Fallback - redirect unknown public paths to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

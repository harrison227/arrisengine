import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a console trace for debugging, but show a friendly UI instead of a blank screen.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught error:", error, info);
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "Something went wrong";

    return (
      <main className="p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Alert variant="destructive">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>
              The page hit an unexpected error. You can try again, or refresh the page.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={this.handleTryAgain}>
              Try again
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error?.stack && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Debug details (dev only)</h2>
              <pre className="mt-2 max-h-80 overflow-auto text-xs text-muted-foreground">
                {this.state.error.stack}
              </pre>
            </section>
          )}
        </div>
      </main>
    );
  }
}

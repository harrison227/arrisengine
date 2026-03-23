import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProtectedRoute() {
  const { user, loading, signOut } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && !profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Account Pending Approval</h1>
          <p className="text-muted-foreground">
            Your account has been created but needs to be approved by an administrator before you can access the platform.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your team admin and check back later.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

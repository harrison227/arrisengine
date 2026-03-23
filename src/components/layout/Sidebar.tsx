import { Link, useLocation } from 'react-router-dom';
import arrisLogo from '@/assets/arris-logo.png';
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  Calendar, 
  UserCog,
  Settings,
  CheckSquare,
  
  ImagePlus,
  Clapperboard,
  FolderOpen,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Target, label: 'Pipeline', path: '/pipeline' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Calendar, label: 'Content Calendar', path: '/content' },
  { icon: Clapperboard, label: 'Content Planner', path: '/content-planner' },
  { icon: FolderOpen, label: 'Saved Plans', path: '/saved-plans' },
  { icon: BarChart3, label: 'Social Analytics', path: '/social-analytics' },
  { icon: ImagePlus, label: 'Image Studio', path: '/image-studio' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: UserCog, label: 'Team', path: '/team' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-card border-r border-border flex flex-col z-50 shadow-sm">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border">
        <img src={arrisLogo} alt="Arris Studios" className="h-8 dark:invert" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          // Use exact path matching to prevent multiple items being highlighted
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <item.icon className={cn(
                'w-[18px] h-[18px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

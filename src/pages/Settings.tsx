import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Bell, Shield, Palette, Database, CreditCard, Building2, Sparkles, ChevronRight, Moon, Sun, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { ActivityLogSection } from '@/components/settings/ActivityLogSection';

type SettingSection = 'profile' | 'notifications' | 'security' | 'appearance' | 'integrations' | 'billing' | 'activity';

const settingSections: { id: SettingSection; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Database },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'activity', label: 'Activity Log', icon: Activity },
];

const quickLinks = [
  { path: '/settings/agency', label: 'Agency Settings', description: 'Branding, logo, colors, email templates', icon: Building2 },
  { path: '/settings/ai', label: 'AI Prompt Studio', description: 'Voice, tone, prompt templates', icon: Sparkles },
];

export default function Settings() {
  const { profile, isLoading, updateProfile, uploadAvatar, isUpdating } = useProfile();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<SettingSection>('profile');
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
  });

  // Ensure theme is mounted before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({ full_name: profile.full_name || '' });
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile({ full_name: formData.full_name });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB allowed', variant: 'destructive' });
      return;
    }
    
    try {
      await uploadAvatar(file);
    } catch (error) {
      console.error('Avatar upload failed:', error);
    }
  };

  const initials = profile?.full_name 
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : profile?.email?.substring(0, 2).toUpperCase() || 'U';

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <Skeleton className="h-64" />
          <div className="lg:col-span-3"><Skeleton className="h-96" /></div>
        </div>
      </div>
    );
  }

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <>
            <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-6">Profile Information</h2>
              
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">{initials}</span>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Change Avatar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    value={formData.full_name} 
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="bg-secondary border-border" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profile?.email || ''} disabled className="bg-secondary border-border" />
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </>
        );
      
      case 'notifications':
        return (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-6">Notification Preferences</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates about your clients</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Pipeline Updates</p>
                  <p className="text-sm text-muted-foreground">Get notified when leads move stages</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Content Reminders</p>
                  <p className="text-sm text-muted-foreground">Reminders for upcoming filming dates</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-6">Appearance</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {mounted && theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
                  </div>
                </div>
                <Switch 
                  checked={mounted && theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
              
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Your theme preference will be saved and applied across all sessions.
                </p>
              </div>
            </div>
          </div>
        );

      case 'activity':
        return <ActivityLogSection />;
      
      default:
        return (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <p className="text-muted-foreground">This section is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          {/* Quick Links to Agency & AI Settings */}
          <div className="mb-6 space-y-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </Link>
              );
            })}
          </div>
          
          <nav className="space-y-1">
            {settingSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="lg:col-span-3">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
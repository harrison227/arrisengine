import { useState, useEffect } from 'react';
import { Clock, Save, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClient, useClients } from '@/hooks/useClients';
import { useLateAccountMappings } from '@/hooks/useLateAccountMappings';
import { useToast } from '@/hooks/use-toast';

interface LateSettingsTabProps {
  clientId: string;
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'instagram_stories', label: 'Instagram Stories', icon: '📱' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'facebook_stories', label: 'Facebook Stories', icon: '📱' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'twitter', label: 'Twitter/X', icon: '🐦' },
];

export function LateSettingsTab({ clientId }: LateSettingsTabProps) {
  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { updateClient, isUpdating } = useClients();
  const { mappings, isLoading: mappingsLoading, createMapping, updateMapping, deleteMapping } = useLateAccountMappings(clientId);
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState('');
  const [profileId, setProfileId] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // New mapping form state
  const [newPlatform, setNewPlatform] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    if (client) {
      setApiKey(client.late_api_key || '');
      setProfileId(client.late_profile_id || '');
    }
  }, [client]);

  const handleSaveSettings = () => {
    updateClient({
      id: clientId,
      late_api_key: apiKey || null,
      late_profile_id: profileId || null,
      late_connected_at: apiKey && profileId ? new Date().toISOString() : null,
    });
    setHasChanges(false);
    toast({ title: 'Late settings saved' });
  };

  const handleAddMapping = () => {
    if (!newPlatform || !newAccountId) {
      toast({ title: 'Please fill in platform and account ID', variant: 'destructive' });
      return;
    }

    createMapping({
      client_id: clientId,
      platform: newPlatform,
      late_account_id: newAccountId,
      account_username: newUsername || null,
    });

    setNewPlatform('');
    setNewAccountId('');
    setNewUsername('');
  };

  const usedPlatforms = mappings.map(m => m.platform);
  const availablePlatforms = PLATFORMS.filter(p => !usedPlatforms.includes(p.id));

  const isConnected = !!(client?.late_api_key && client?.late_profile_id);

  if (clientLoading || mappingsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Late Integration</CardTitle>
                <CardDescription>Connect to Late for social scheduling</CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'} className={isConnected ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}>
              {isConnected ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="late-api-key">Late API Key</Label>
              <Input
                id="late-api-key"
                type="password"
                placeholder="Enter your Late API key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setHasChanges(true);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="late-profile-id">Late Profile ID</Label>
              <Input
                id="late-profile-id"
                placeholder="Enter your Late profile ID"
                value={profileId}
                onChange={(e) => {
                  setProfileId(e.target.value);
                  setHasChanges(true);
                }}
              />
            </div>
          </div>

          {client?.late_connected_at && (
            <p className="text-sm text-muted-foreground">
              Connected on: {new Date(client.late_connected_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}

          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges || isUpdating}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isUpdating ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Account Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Account Mappings</CardTitle>
          <CardDescription>
            Map each social platform to its corresponding Late account ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Mappings */}
          {mappings.length > 0 && (
            <div className="space-y-3">
              {mappings.map((mapping) => {
                const platform = PLATFORMS.find(p => p.id === mapping.platform);
                return (
                  <div
                    key={mapping.id}
                    className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <span className="text-lg">{platform?.icon}</span>
                      <span className="font-medium">{platform?.label || mapping.platform}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Late Account ID"
                        value={mapping.late_account_id}
                        onChange={(e) => updateMapping({ id: mapping.id, late_account_id: e.target.value })}
                      />
                      <Input
                        placeholder="Username (optional)"
                        value={mapping.account_username || ''}
                        onChange={(e) => updateMapping({ id: mapping.id, account_username: e.target.value })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMapping(mapping.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Mapping */}
          {availablePlatforms.length > 0 && (
            <div className="flex items-end gap-3 pt-4 border-t border-border">
              <div className="space-y-2 min-w-[160px]">
                <Label>Platform</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlatforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        <span className="flex items-center gap-2">
                          <span>{platform.icon}</span>
                          {platform.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Late Account ID</Label>
                <Input
                  placeholder="Enter Late account ID"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Username (optional)</Label>
                <Input
                  placeholder="@username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
              <Button onClick={handleAddMapping} className="gap-2">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          )}

          {mappings.length === 0 && availablePlatforms.length === PLATFORMS.length && (
            <p className="text-center text-muted-foreground py-4">
              No platform mappings configured. Add one above to start syncing content.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

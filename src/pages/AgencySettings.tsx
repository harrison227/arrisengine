import { useState, useRef, useEffect } from 'react';
import { Building2, Upload, Palette, Clock, Mail, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { useEmailTemplates, EmailTemplateType } from '@/hooks/useEmailTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';

const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland'
];

const templateTypes: { value: EmailTemplateType; label: string }[] = [
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'report', label: 'Report' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'custom', label: 'Custom' },
];

export default function AgencySettings() {
  const { settings, isLoading, upsertSettings, uploadLogo, isUpdating, isUploading } = useAgencySettings();
  const { templates: emailTemplates, createTemplate, updateTemplate, deleteTemplate, isCreating } = useEmailTemplates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    agency_name: '',
    primary_color: '#8B5CF6',
    secondary_color: '#1E1E2E',
    timezone: 'UTC',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    default_email_signature: '',
  });

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState({
    name: '',
    subject: '',
    body: '',
    template_type: 'custom' as EmailTemplateType,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        agency_name: settings.agency_name || '',
        primary_color: settings.primary_color || '#8B5CF6',
        secondary_color: settings.secondary_color || '#1E1E2E',
        timezone: settings.timezone || 'UTC',
        working_hours_start: settings.working_hours_start || '09:00',
        working_hours_end: settings.working_hours_end || '17:00',
        default_email_signature: settings.default_email_signature || '',
      });
    }
  }, [settings]);

  const handleSave = () => {
    upsertSettings(formData);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  };

  const handleEmailSubmit = () => {
    if (editingEmail) {
      updateTemplate({ id: editingEmail, ...emailForm });
    } else {
      createTemplate(emailForm);
    }
    setEmailDialogOpen(false);
    setEditingEmail(null);
    setEmailForm({ name: '', subject: '', body: '', template_type: 'custom' });
  };

  const openEditEmail = (template: typeof emailTemplates[0]) => {
    setEditingEmail(template.id);
    setEmailForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      template_type: template.template_type,
    });
    setEmailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary" />
          Agency Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure your agency branding and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Branding
            </CardTitle>
            <CardDescription>Your agency's visual identity for PDFs and client communications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="Agency logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">PNG, JPG or SVG. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="agencyName">Agency Name</Label>
                <Input
                  id="agencyName"
                  value={formData.agency_name}
                  onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                  placeholder="Your Agency Name"
                  className="bg-secondary border-border"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-12 h-10 p-1 bg-secondary border-border"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1 bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-12 h-10 p-1 bg-secondary border-border"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1 bg-secondary border-border"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Working Hours
            </CardTitle>
            <CardDescription>Default working hours for scheduling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="workStart">Start Time</Label>
                <Input
                  id="workStart"
                  type="time"
                  value={formData.working_hours_start}
                  onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workEnd">End Time</Label>
                <Input
                  id="workEnd"
                  type="time"
                  value={formData.working_hours_end}
                  onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Default Email Signature
            </CardTitle>
            <CardDescription>Used in all client communications</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.default_email_signature}
              onChange={(e) => setFormData({ ...formData, default_email_signature: e.target.value })}
              placeholder="Best regards,&#10;Your Name&#10;Your Agency"
              className="bg-secondary border-border min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Email Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Templates
              </CardTitle>
              <CardDescription>Reusable email templates for client communications</CardDescription>
            </div>
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => {
                  setEditingEmail(null);
                  setEmailForm({ name: '', subject: '', body: '', template_type: 'custom' });
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingEmail ? 'Edit' : 'Create'} Email Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input
                        value={emailForm.name}
                        onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                        placeholder="e.g., Monthly Report"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={emailForm.template_type}
                        onValueChange={(value: EmailTemplateType) => setEmailForm({ ...emailForm, template_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {templateTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                      placeholder="e.g., Your Monthly Performance Report"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea
                      value={emailForm.body}
                      onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                      placeholder="Write your email template... Use {{client_name}}, {{date}}, etc. for variables"
                      className="min-h-[200px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {"{{client_name}}"}, {"{{contact_name}}"}, {"{{date}}"}, {"{{agency_name}}"}
                    </p>
                  </div>
                  <Button onClick={handleEmailSubmit} disabled={isCreating} className="w-full">
                    {editingEmail ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {emailTemplates.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No email templates yet. Create your first one!</p>
            ) : (
              <div className="space-y-3">
                {emailTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{template.name}</p>
                      <p className="text-sm text-muted-foreground">{template.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                        {templateTypes.find(t => t.value === template.template_type)?.label}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => openEditEmail(template)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTemplate(template.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Migration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Storage Migration
            </CardTitle>
            <CardDescription>Migrate existing images to external storage for faster load times</CardDescription>
          </CardHeader>
          <CardContent>
            <MigrateImagesButton />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isUpdating} size="lg">
            {isUpdating ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MigrateImagesButton() {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-images-to-r2', { body: { batchSize: 10 } });
      if (error) throw error;
      sonnerToast.success(data.message || `Migrated ${data.migrated} images`);
    } catch (err: any) {
      sonnerToast.error('Migration failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleMigrate} disabled={isMigrating} variant="outline" className="gap-2">
        {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
        {isMigrating ? 'Migrating...' : 'Migrate Images to R2'}
      </Button>
      <p className="text-sm text-muted-foreground">
        Transfers images from internal storage to Cloudflare R2. Safe to run multiple times.
      </p>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, Globe } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useClientAutomation } from '@/hooks/useClientAutomation';
import { useAuth } from '@/contexts/AuthContext';

const clientSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  contact_name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().min(1, 'Industry is required'),
  mrr: z.number().min(0, 'MRR must be positive'),
  contract_start: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const industries = ['E-commerce', 'SaaS', 'Healthcare', 'Finance', 'Real Estate', 'Fitness', 'Food & Beverage', 'Education', 'Other'];

export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const { user } = useAuth();
  const { createClient, isCreating } = useClients();
  const { runAutomation, isRunning, progress, resetProgress } = useClientAutomation();
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [showAutomation, setShowAutomation] = useState(false);
  const [isPersonal, setIsPersonal] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      mrr: 0,
    },
  });

  const websiteValue = watch('website');

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setShowAutomation(false);
      resetProgress();
    }
  }, [open, resetProgress]);

  const onSubmit = async (data: ClientFormData) => {
    createClient({
      business_name: data.business_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone || null,
      website: data.website || null,
      industry: data.industry,
      mrr: isPersonal ? 0 : data.mrr,
      contract_start: data.contract_start || null,
      status: 'onboarding',
      is_personal: isPersonal,
    }, {
      onSuccess: async (newClient) => {
        // If website is provided, run AI automation
        if (data.website && user) {
          setShowAutomation(true);
          await runAutomation(
            newClient.id,
            data.website,
            data.business_name,
            data.industry,
            user.id
          );
        }
        
        reset();
        setSelectedIndustry('');
        setIsPersonal(false);
        onOpenChange(false);
      },
    });
  };

  const getProgressMessage = () => {
    switch (progress.step) {
      case 'scraping':
        return 'Analyzing website content...';
      case 'building_knowledge':
        return 'Building knowledge base with AI...';
      case 'generating_strategy':
        return 'Creating 30-day content strategy...';
      case 'complete':
        return 'AI automation complete!';
      case 'error':
        return progress.message;
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add New Client
            {websiteValue && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI will auto-populate
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {showAutomation && isRunning ? (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold">AI Automation Running</h3>
              <p className="text-sm text-muted-foreground">{getProgressMessage()}</p>
            </div>
            <Progress value={progress.progress} className="h-2" />
            <div className="flex justify-center gap-2 text-xs text-muted-foreground">
              <span className={progress.step === 'scraping' ? 'text-primary font-medium' : ''}>Scrape</span>
              <span>→</span>
              <span className={progress.step === 'building_knowledge' ? 'text-primary font-medium' : ''}>Knowledge</span>
              <span>→</span>
              <span className={progress.step === 'generating_strategy' ? 'text-primary font-medium' : ''}>Strategy</span>
              <span>→</span>
              <span className={progress.step === 'complete' ? 'text-primary font-medium' : ''}>Done</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  {...register('business_name')}
                  className="bg-secondary border-border"
                />
                {errors.business_name && (
                  <p className="text-sm text-destructive">{errors.business_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name *</Label>
                <Input
                  id="contact_name"
                  {...register('contact_name')}
                  className="bg-secondary border-border"
                />
                {errors.contact_name && (
                  <p className="text-sm text-destructive">{errors.contact_name.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="bg-secondary border-border"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website
                <span className="text-xs text-muted-foreground ml-1">(enables AI automation)</span>
              </Label>
              <Input
                id="website"
                placeholder="https://example.com"
                {...register('website')}
                className="bg-secondary border-border"
              />
              {errors.website && (
                <p className="text-sm text-destructive">{errors.website.message}</p>
              )}
              {websiteValue && !errors.website && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI will scrape this website and auto-build knowledge base + content strategy
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry *</Label>
                <Select 
                  value={selectedIndustry} 
                  onValueChange={(value) => {
                    setSelectedIndustry(value);
                    setValue('industry', value);
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mrr">Monthly Retainer ($)</Label>
                <Input
                  id="mrr"
                  type="number"
                  {...register('mrr', { valueAsNumber: true })}
                  className="bg-secondary border-border"
                />
                {errors.mrr && (
                  <p className="text-sm text-destructive">{errors.mrr.message}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contract_start">Contract Start</Label>
              <Input
                id="contract_start"
                type="date"
                {...register('contract_start')}
                className="bg-secondary border-border"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-secondary/50">
              <div>
                <Label htmlFor="is_personal" className="text-sm font-medium">Personal / Test Client</Label>
                <p className="text-xs text-muted-foreground">Won't count towards MRR or client totals</p>
              </div>
              <Switch
                id="is_personal"
                checked={isPersonal}
                onCheckedChange={setIsPersonal}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isRunning}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : websiteValue ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Add & Run AI
                  </>
                ) : (
                  'Add Client'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

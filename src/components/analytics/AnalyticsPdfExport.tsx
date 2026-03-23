import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { AnalyticsData } from '@/hooks/useLateAnalytics';
import { generateAnalyticsPdf, PdfExportOptions } from '@/lib/analyticsPdf';
import { toast } from 'sonner';

interface AnalyticsPdfExportProps {
  data: AnalyticsData;
  agencyName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnalyticsPdfExport({ data, agencyName, open, onOpenChange }: AnalyticsPdfExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<PdfExportOptions>({
    includeOverview: true,
    includeFollowerGrowth: true,
    includeEngagement: true,
    includeTopPosts: true,
    includePlatformBreakdown: true,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateAnalyticsPdf(data, options, agencyName);
      toast.success('PDF exported successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleOption = (key: keyof PdfExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportOptions = [
    { key: 'includeOverview' as const, label: 'Overview Metrics', description: 'Followers, impressions, reach, engagement rate' },
    { key: 'includeEngagement' as const, label: 'Engagement Metrics', description: 'Likes, comments, shares, clicks' },
    { key: 'includePlatformBreakdown' as const, label: 'Platform Breakdown', description: 'Metrics by platform' },
    { key: 'includeTopPosts' as const, label: 'Top Posts', description: 'Best performing content' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Analytics Report</DialogTitle>
          <DialogDescription>
            Select which sections to include in your PDF report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {exportOptions.map((option) => (
            <div key={option.key} className="flex items-start space-x-3">
              <Checkbox
                id={option.key}
                checked={options[option.key]}
                onCheckedChange={() => toggleOption(option.key)}
              />
              <div className="space-y-0.5">
                <Label htmlFor={option.key} className="cursor-pointer font-medium">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !Object.values(options).some(Boolean)}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

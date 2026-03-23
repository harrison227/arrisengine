import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKPIs } from '@/hooks/useKPIs';
import { Tables } from '@/integrations/supabase/types';

type KPI = Tables<'kpis'>;

interface LogKPIEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi: KPI;
}

export function LogKPIEntryDialog({ open, onOpenChange, kpi }: LogKPIEntryDialogProps) {
  const { logEntry, isLogging } = useKPIs(kpi.client_id);
  const [formData, setFormData] = useState({
    value: 0,
    recorded_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logEntry({
      kpi_id: kpi.id,
      value: formData.value,
      recorded_date: formData.recorded_date,
    }, {
      onSuccess: () => {
        setFormData({ value: 0, recorded_date: new Date().toISOString().split('T')[0] });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Log Entry: {kpi.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">Value ({kpi.unit})</Label>
            <Input
              id="value"
              type="number"
              step="any"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recorded_date">Date</Label>
            <Input
              id="recorded_date"
              type="date"
              value={formData.recorded_date}
              onChange={(e) => setFormData({ ...formData, recorded_date: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLogging}>
              {isLogging ? 'Logging...' : 'Log Entry'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

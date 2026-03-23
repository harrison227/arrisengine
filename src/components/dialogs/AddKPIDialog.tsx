import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKPIs } from '@/hooks/useKPIs';

interface AddKPIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function AddKPIDialog({ open, onOpenChange, clientId }: AddKPIDialogProps) {
  const { createKPI, isCreating } = useKPIs(clientId);
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    target: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createKPI({
      client_id: clientId,
      ...formData,
    }, {
      onSuccess: () => {
        setFormData({ name: '', unit: '', target: 0 });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add KPI</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">KPI Name</Label>
            <Input
              id="name"
              placeholder="e.g., Website Traffic, Conversion Rate"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g., visitors, %, $"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target</Label>
              <Input
                id="target"
                type="number"
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create KPI'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

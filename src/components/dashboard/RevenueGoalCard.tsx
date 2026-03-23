import { useState } from 'react';
import { Target, TrendingUp, Plus, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRevenueGoals, GoalPeriod } from '@/hooks/useRevenueGoals';
import { useClients } from '@/hooks/useClients';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function RevenueGoalCard() {
  const { currentGoal, createGoal, updateGoal, isCreating } = useRevenueGoals();
  const { clients } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    period: 'monthly' as GoalPeriod,
    target_amount: '',
  });

  // Calculate current MRR
  const currentMRR = clients
    .filter(c => (c.status === 'active' || c.status === 'onboarding') && !(c as any).is_personal)
    .reduce((sum, c) => sum + c.mrr, 0);

  const progress = currentGoal 
    ? Math.min((currentMRR / currentGoal.target_amount) * 100, 100)
    : 0;

  const handleSubmit = () => {
    if (currentGoal) {
      updateGoal({ id: currentGoal.id, target_amount: parseFloat(form.target_amount) });
    } else {
      createGoal({ period: form.period, target_amount: parseFloat(form.target_amount) });
    }
    setDialogOpen(false);
  };

  const getStatusColor = () => {
    if (progress >= 100) return 'text-green-500';
    if (progress >= 75) return 'text-blue-500';
    if (progress >= 50) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Revenue Goal
          </CardTitle>
          <CardDescription>
            {currentGoal 
              ? `${currentGoal.period.charAt(0).toUpperCase() + currentGoal.period.slice(1)} goal: ${format(new Date(currentGoal.start_date), 'MMM d')} - ${format(new Date(currentGoal.end_date), 'MMM d, yyyy')}`
              : 'No goal set for this period'}
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setForm({
                period: currentGoal?.period || 'monthly',
                target_amount: currentGoal?.target_amount.toString() || '',
              })}
            >
              {currentGoal ? <Edit2 className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {currentGoal ? 'Edit' : 'Set Goal'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentGoal ? 'Update' : 'Set'} Revenue Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!currentGoal && (
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={form.period}
                    onValueChange={(value: GoalPeriod) => setForm({ ...form, period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Target Amount ($)</Label>
                <Input
                  type="number"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="10000"
                />
              </div>
              <Button onClick={handleSubmit} disabled={!form.target_amount || isCreating} className="w-full">
                {isCreating ? 'Saving...' : 'Save Goal'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {currentGoal ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className={cn("text-3xl font-bold", getStatusColor())}>
                  ${currentMRR.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  of ${currentGoal.target_amount.toLocaleString()} target
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-2xl font-bold", getStatusColor())}>
                  {progress.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {progress >= 100 ? 'Goal reached!' : `$${(currentGoal.target_amount - currentMRR).toLocaleString()} to go`}
                </p>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-2">Set a revenue goal to track your progress</p>
            <p className="text-2xl font-bold text-foreground">Current MRR: ${currentMRR.toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

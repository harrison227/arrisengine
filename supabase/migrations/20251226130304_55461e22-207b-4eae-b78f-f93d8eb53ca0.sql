-- Revenue goals table
CREATE TYPE public.goal_period AS ENUM ('monthly', 'quarterly', 'yearly');

CREATE TABLE public.revenue_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period public.goal_period NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own revenue goals"
  ON public.revenue_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own revenue goals"
  ON public.revenue_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own revenue goals"
  ON public.revenue_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own revenue goals"
  ON public.revenue_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_revenue_goals_updated_at
  BEFORE UPDATE ON public.revenue_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add lost_reason column to leads for win/loss tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
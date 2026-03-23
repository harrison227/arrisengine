-- Task status enum
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'complete');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  content_plan_id UUID REFERENCES public.content_plans(id) ON DELETE SET NULL,
  assigned_to UUID,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task comments for discussions
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content approval workflow
CREATE TYPE public.approval_status AS ENUM ('draft', 'internal_review', 'client_review', 'revision_requested', 'approved', 'published');

-- Content approvals table
CREATE TABLE public.content_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_piece_id UUID NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  review_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content comments for feedback
CREATE TABLE public.content_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_piece_id UUID NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reminders/Notifications table
CREATE TYPE public.reminder_type AS ENUM ('filming', 'follow_up', 'contract_renewal', 'task_due', 'stale_lead', 'custom');

CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_type public.reminder_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  related_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  related_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_content_plan_id UUID REFERENCES public.content_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view tasks they created or are assigned to"
  ON public.tasks FOR SELECT
  USING (user_id = auth.uid() OR assigned_to = auth.uid() OR is_admin_or_owner(auth.uid()));

CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks or tasks assigned to them"
  ON public.tasks FOR UPDATE
  USING (user_id = auth.uid() OR assigned_to = auth.uid() OR is_admin_or_owner(auth.uid()));

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (user_id = auth.uid() OR is_admin_or_owner(auth.uid()));

-- Task comments policies
CREATE POLICY "Users can view task comments"
  ON public.task_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_comments.task_id 
    AND (tasks.user_id = auth.uid() OR tasks.assigned_to = auth.uid() OR is_admin_or_owner(auth.uid()))
  ));

CREATE POLICY "Users can create task comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.task_comments FOR DELETE
  USING (user_id = auth.uid());

-- Content approvals policies
CREATE POLICY "Users can view content approvals"
  ON public.content_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_pieces cp
    JOIN public.content_plans pl ON cp.content_plan_id = pl.id
    WHERE cp.id = content_approvals.content_piece_id
    AND has_client_access(auth.uid(), pl.client_id)
  ));

CREATE POLICY "Admins can manage content approvals"
  ON public.content_approvals FOR ALL
  USING (is_admin_or_owner(auth.uid()));

-- Content comments policies  
CREATE POLICY "Users can view content comments"
  ON public.content_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_pieces cp
    JOIN public.content_plans pl ON cp.content_plan_id = pl.id
    WHERE cp.id = content_comments.content_piece_id
    AND has_client_access(auth.uid(), pl.client_id)
  ));

CREATE POLICY "Users can create content comments"
  ON public.content_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content comments"
  ON public.content_comments FOR DELETE
  USING (user_id = auth.uid());

-- Reminders policies
CREATE POLICY "Users can view their own reminders"
  ON public.reminders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reminders"
  ON public.reminders FOR DELETE
  USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_approvals_updated_at
  BEFORE UPDATE ON public.content_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
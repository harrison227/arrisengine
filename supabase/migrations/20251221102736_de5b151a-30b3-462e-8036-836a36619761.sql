-- Create enum types for various statuses
CREATE TYPE public.pipeline_stage AS ENUM ('new', 'contacted', 'proposal', 'negotiating', 'won', 'lost');
CREATE TYPE public.client_status AS ENUM ('onboarding', 'active', 'paused', 'churned');
CREATE TYPE public.content_status AS ENUM ('idea', 'scripted', 'filmed', 'edited', 'approved', 'live');
CREATE TYPE public.content_type AS ENUM ('video', 'image', 'carousel', 'story', 'reel', 'ugc');
CREATE TYPE public.ad_platform AS ENUM ('meta', 'google', 'tiktok', 'linkedin');
CREATE TYPE public.campaign_type AS ENUM ('awareness', 'traffic', 'leads', 'sales');
CREATE TYPE public.ad_status AS ENUM ('draft', 'scheduled', 'live', 'paused', 'completed');
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'strategist', 'contractor', 'editor');
CREATE TYPE public.knowledge_category AS ENUM ('brand', 'audience', 'competitors', 'offers', 'past_results', 'notes', 'compliance');
CREATE TYPE public.content_plan_status AS ENUM ('planning', 'scheduled', 'filming', 'editing', 'complete');
CREATE TYPE public.scope_status AS ENUM ('draft', 'active', 'completed');
CREATE TYPE public.asset_type AS ENUM ('logo', 'guidelines', 'footage', 'creative', 'document');

-- Profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'contractor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Leads table (sales pipeline)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL,
  stage pipeline_stage NOT NULL DEFAULT 'new',
  proposal_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  next_follow_up DATE,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  industry TEXT NOT NULL,
  status client_status NOT NULL DEFAULT 'onboarding',
  mrr NUMERIC(12,2) NOT NULL DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  converted_from_lead_id UUID REFERENCES public.leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client team assignments (which team members can access which clients)
CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Knowledge entries (per client knowledge base)
CREATE TABLE public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category knowledge_category NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scopes (service agreements)
CREATE TABLE public.scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  retainer NUMERIC(12,2) NOT NULL DEFAULT 0,
  setup_fee NUMERIC(12,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status scope_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scope deliverables
CREATE TABLE public.scope_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES public.scopes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  frequency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPIs
CREATE TABLE public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target NUMERIC(12,2) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI entries (tracking values over time)
CREATE TABLE public.kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  value NUMERIC(12,2) NOT NULL,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content plans
CREATE TABLE public.content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status content_plan_status NOT NULL DEFAULT 'planning',
  filming_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  brief TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content pieces
CREATE TABLE public.content_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID NOT NULL REFERENCES public.content_plans(id) ON DELETE CASCADE,
  content_type content_type NOT NULL,
  concept TEXT NOT NULL,
  hook TEXT,
  status content_status NOT NULL DEFAULT 'idea',
  platform TEXT NOT NULL,
  asset_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets (file storage references)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type asset_type NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad launches
CREATE TABLE public.ad_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform ad_platform NOT NULL,
  campaign_type campaign_type NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status ad_status NOT NULL DEFAULT 'draft',
  ad_account_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link between ad launches and content pieces
CREATE TABLE public.ad_launch_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_launch_id UUID NOT NULL REFERENCES public.ad_launches(id) ON DELETE CASCADE,
  content_piece_id UUID NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  UNIQUE(ad_launch_id, content_piece_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_launch_content ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = $1 LIMIT 1
$$;

-- Function to check if user is owner/admin (can see all data)
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 
    AND role IN ('owner', 'admin')
  )
$$;

-- Function to check if user has access to a client
CREATE OR REPLACE FUNCTION public.has_client_access(user_id UUID, client_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments 
    WHERE client_assignments.user_id = $1 
    AND client_assignments.client_id = $2
  ) OR public.is_admin_or_owner($1)
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin_or_owner(auth.uid()));

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- Leads policies (only owners/admins see leads - sales pipeline)
CREATE POLICY "Owners can manage leads" ON public.leads
  FOR ALL USING (
    user_id = auth.uid() OR public.is_admin_or_owner(auth.uid())
  );

-- Clients policies
CREATE POLICY "Owners can manage all clients" ON public.clients
  FOR ALL USING (user_id = auth.uid() OR public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Team members can view assigned clients" ON public.clients
  FOR SELECT USING (public.has_client_access(auth.uid(), id));

-- Client assignments policies
CREATE POLICY "Admins can manage client assignments" ON public.client_assignments
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Users can view their assignments" ON public.client_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Knowledge entries policies
CREATE POLICY "Users with client access can view knowledge" ON public.knowledge_entries
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage knowledge" ON public.knowledge_entries
  FOR ALL USING (public.has_client_access(auth.uid(), client_id));

-- Scopes policies
CREATE POLICY "Users with client access can view scopes" ON public.scopes
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Admins can manage scopes" ON public.scopes
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- Scope deliverables policies
CREATE POLICY "Users can view deliverables of accessible scopes" ON public.scope_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scopes 
      WHERE scopes.id = scope_deliverables.scope_id 
      AND public.has_client_access(auth.uid(), scopes.client_id)
    )
  );

CREATE POLICY "Admins can manage deliverables" ON public.scope_deliverables
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- KPIs policies
CREATE POLICY "Users with client access can view KPIs" ON public.kpis
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Admins can manage KPIs" ON public.kpis
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- KPI entries policies
CREATE POLICY "Users can view entries of accessible KPIs" ON public.kpi_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.kpis 
      WHERE kpis.id = kpi_entries.kpi_id 
      AND public.has_client_access(auth.uid(), kpis.client_id)
    )
  );

CREATE POLICY "Admins can manage KPI entries" ON public.kpi_entries
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- Content plans policies
CREATE POLICY "Users with client access can view content plans" ON public.content_plans
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage content plans" ON public.content_plans
  FOR ALL USING (public.has_client_access(auth.uid(), client_id));

-- Content pieces policies
CREATE POLICY "Users can view pieces of accessible plans" ON public.content_pieces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_plans 
      WHERE content_plans.id = content_pieces.content_plan_id 
      AND public.has_client_access(auth.uid(), content_plans.client_id)
    )
  );

CREATE POLICY "Users can manage pieces of accessible plans" ON public.content_pieces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.content_plans 
      WHERE content_plans.id = content_pieces.content_plan_id 
      AND public.has_client_access(auth.uid(), content_plans.client_id)
    )
  );

-- Assets policies
CREATE POLICY "Users with client access can view assets" ON public.assets
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can manage assets" ON public.assets
  FOR ALL USING (public.has_client_access(auth.uid(), client_id));

-- Ad launches policies
CREATE POLICY "Users with client access can view ad launches" ON public.ad_launches
  FOR SELECT USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Admins can manage ad launches" ON public.ad_launches
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- Ad launch content policies
CREATE POLICY "Users can view ad launch content" ON public.ad_launch_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ad_launches 
      WHERE ad_launches.id = ad_launch_content.ad_launch_id 
      AND public.has_client_access(auth.uid(), ad_launches.client_id)
    )
  );

CREATE POLICY "Admins can manage ad launch content" ON public.ad_launch_content
  FOR ALL USING (public.is_admin_or_owner(auth.uid()));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- First user becomes owner, others are contractors by default
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'contractor');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_knowledge_entries_updated_at BEFORE UPDATE ON public.knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scopes_updated_at BEFORE UPDATE ON public.scopes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpis_updated_at BEFORE UPDATE ON public.kpis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_plans_updated_at BEFORE UPDATE ON public.content_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_pieces_updated_at BEFORE UPDATE ON public.content_pieces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ad_launches_updated_at BEFORE UPDATE ON public.ad_launches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
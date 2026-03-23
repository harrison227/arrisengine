export type PipelineStage = 'new' | 'contacted' | 'proposal' | 'negotiating' | 'won' | 'lost';

export type ClientStatus = 'onboarding' | 'active' | 'paused' | 'churned';

export type ContentStatus = 'idea' | 'scripted' | 'filmed' | 'edited' | 'approved' | 'live';

export type ContentType = 'video' | 'image' | 'carousel' | 'story' | 'reel' | 'ugc';

export type AdPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin';

export type CampaignType = 'awareness' | 'traffic' | 'leads' | 'sales';

export type AdStatus = 'draft' | 'scheduled' | 'live' | 'paused' | 'completed';

export type TeamRole = 'owner' | 'contractor' | 'editor' | 'strategist';

export type KnowledgeCategory = 'brand' | 'audience' | 'competitors' | 'offers' | 'past_results' | 'notes' | 'compliance';

export interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  source: string;
  stage: PipelineStage;
  proposalValue: number;
  notes: string;
  nextFollowUp?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  industry: string;
  status: ClientStatus;
  mrr: number;
  contractStart?: string;
  contractEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntry {
  id: string;
  clientId: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Scope {
  id: string;
  clientId: string;
  title: string;
  description: string;
  deliverables: ScopeDeliverable[];
  retainer: number;
  setupFee?: number;
  startDate: string;
  endDate?: string;
  status: 'draft' | 'active' | 'completed';
}

export interface ScopeDeliverable {
  id: string;
  description: string;
  frequency?: string;
}

export interface KPI {
  id: string;
  clientId: string;
  name: string;
  target: number;
  unit: string;
  entries: KPIEntry[];
}

export interface KPIEntry {
  id: string;
  value: number;
  date: string;
}

export interface ContentPlan {
  id: string;
  clientId: string;
  title: string;
  status: 'planning' | 'scheduled' | 'filming' | 'editing' | 'complete';
  filmingDate?: string;
  assignedTo?: string;
  brief?: string;
  pieces: ContentPiece[];
}

export interface ContentPiece {
  id: string;
  type: ContentType;
  concept: string;
  hook?: string;
  status: ContentStatus;
  platform: string;
  assetUrl?: string;
}

export interface Asset {
  id: string;
  clientId: string;
  name: string;
  type: 'logo' | 'guidelines' | 'footage' | 'creative' | 'document';
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  createdAt: string;
}

export interface AdLaunch {
  id: string;
  clientId: string;
  name: string;
  platform: AdPlatform;
  campaignType: CampaignType;
  budget: number;
  startDate: string;
  endDate?: string;
  status: AdStatus;
  adAccountLink?: string;
  notes?: string;
  contentPieceIds: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl?: string;
  assignedClientIds: string[];
}

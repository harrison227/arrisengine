import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PipelineColumn } from '@/components/pipeline/PipelineColumn';
import { LeadCard } from '@/components/pipeline/LeadCard';
import { LeadDetailSheet } from '@/components/pipeline/LeadDetailSheet';
import { useLeads } from '@/hooks/useLeads';
import { AddLeadDialog } from '@/components/dialogs/AddLeadDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, Database } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;
type PipelineStage = Database['public']['Enums']['pipeline_stage'];

const stages: { id: PipelineStage; title: string }[] = [
  { id: 'new', title: 'New' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'proposal', title: 'Proposal Sent' },
  { id: 'negotiating', title: 'Negotiating' },
  { id: 'won', title: 'Won' },
  { id: 'lost', title: 'Lost' },
];

export default function Pipeline() {
  const [searchQuery, setSearchQuery] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { leads, isLoading, updateLead } = useLeads();

  const filteredLeads = leads.filter(lead =>
    lead.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLeadsByStage = (stage: PipelineStage) => 
    filteredLeads.filter(lead => lead.stage === stage);

  const getStageValue = (stage: PipelineStage) =>
    getLeadsByStage(stage).reduce((sum, lead) => sum + Number(lead.proposal_value), 0);

  const handleDrop = (leadId: string, newStage: PipelineStage) => {
    updateLead({ id: leadId, stage: newStage });
  };

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground mt-1">Track and manage your sales leads</p>
        </div>
        <Button className="gap-2" onClick={() => setAddLeadOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <PipelineColumn
              key={stage.id}
              stage={stage.id}
              title={stage.title}
              count={stageLeads.length}
              value={getStageValue(stage.id)}
              onDrop={handleDrop}
            >
              {stageLeads.map((lead) => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onCardClick={handleCardClick}
                />
              ))}
            </PipelineColumn>
          );
        })}
      </div>

      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />
      
      <LeadDetailSheet
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

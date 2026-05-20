import { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, Brain, FileText, FolderOpen, Megaphone, Target, FileDown, Lightbulb, Video, Palette, FileSignature, Link2, Clock, Package } from 'lucide-react';
import { useClient } from '@/hooks/useClients';
import { ClientHeader } from '@/components/client-detail/ClientHeader';
import { KnowledgeBase } from '@/components/client-detail/KnowledgeBase';
import { ContentTab } from '@/components/client-detail/ContentTab';
import { AdsTab } from '@/components/client-detail/AdsTab';
import { AssetsTab } from '@/components/client-detail/AssetsTab';
import { KPIsTab } from '@/components/client-detail/KPIsTab';
import { AIActionsPanel } from '@/components/client-detail/AIActionsPanel';
import { FilmingDayBanner } from '@/components/filming/FilmingDayBanner';
import { FilmingDayTab } from '@/components/client-detail/FilmingDayTab';
import { CreativeConceptsTab } from '@/components/client-detail/CreativeConceptsTab';
import { BrandTab } from '@/components/client-detail/BrandTab';
import { BrandPackTab } from '@/components/brand-pack/BrandPackTab';
import { ContractsTab } from '@/components/client-detail/ContractsTab';
import { ShareLinksTab } from '@/components/client-detail/ShareLinksTab';
import { LateSettingsTab } from '@/components/client-detail/LateSettingsTab';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'brand', label: 'Brand', icon: Palette },
  { id: 'brand-pack', label: 'Brand Pack', icon: Package },
  { id: 'filming', label: 'Filming Day', icon: Video },
  { id: 'creatives', label: 'Creatives', icon: Lightbulb },
  { id: 'knowledge', label: 'Knowledge', icon: Brain },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'late', label: 'Late Sync', icon: Clock },
  { id: 'assets', label: 'Assets', icon: FolderOpen },
  { id: 'ads', label: 'Ads', icon: Megaphone },
  { id: 'kpis', label: 'KPIs', icon: Target },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'sharelinks', label: 'Calendar Links', icon: Link2 },
];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const { data: client, isLoading, error } = useClient(id);

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-32 mb-8" />
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10 w-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !client) {
    return <Navigate to="/clients" replace />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Filming Day Banner - most important */}
            <FilmingDayBanner clientId={client.id} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monthly Retainer</span>
                      <span className="font-semibold text-foreground">${Number(client.mrr).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Contract Start</span>
                      <span className="font-medium text-foreground">
                        {client.contract_start 
                          ? new Date(client.contract_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Not set'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Primary Contact</span>
                      <span className="font-medium text-foreground">{client.contact_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Website</span>
                      <span className="font-medium text-foreground">
                        {client.website ? (
                          <a 
                            href={client.website.startsWith('http') ? client.website : `https://${client.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary hover:underline"
                          >
                            {(() => {
                              try {
                                const url = client.website.startsWith('http') ? client.website : `https://${client.website}`;
                                return new URL(url).hostname;
                              } catch {
                                return client.website;
                              }
                            })()}
                          </a>
                        ) : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Onboarding</h3>
                    <Link to={`/onboarding/${client.id}`}>
                      <Button variant="outline" size="sm">
                        <FileDown className="w-4 h-4 mr-2" />
                        Generate PDF
                      </Button>
                    </Link>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Create a personalized onboarding PDF with AI-generated content, process explanations, and the content strategy.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <AIActionsPanel 
                  clientId={client.id}
                  clientName={client.business_name}
                  industry={client.industry}
                  website={client.website}
                />
              </div>
            </div>
          </div>
        );
      case 'brand':
        return <BrandTab client={client} />;
      case 'brand-pack':
        return <BrandPackTab clientId={client.id} />;
      case 'filming':
        return <FilmingDayTab clientId={client.id} />;
      case 'creatives':
        return <CreativeConceptsTab clientId={client.id} />;
      case 'knowledge':
        return <KnowledgeBase clientId={client.id} clientName={client.business_name} />;
      case 'content':
        return <ContentTab clientId={client.id} />;
      case 'assets':
        return <AssetsTab clientId={client.id} />;
      case 'ads':
        return <AdsTab clientId={client.id} clientName={client.business_name} industry={client.industry} />;
      case 'kpis':
        return <KPIsTab clientId={client.id} />;
      case 'contracts':
        return <ContractsTab clientId={client.id} />;
      case 'sharelinks':
        return <ShareLinksTab clientId={client.id} />;
      case 'late':
        return <LateSettingsTab clientId={client.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <ClientHeader client={client} />

      {/* Tabs */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap -mb-px',
                activeTab === tab.id
                  ? 'bg-secondary text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}

import { Building2, Target, Sparkles, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KnowledgeSummary {
  positioning_summary: string | null;
  key_differentiators: string[] | null;
  ideal_customer_profile: string | null;
  content_opportunities: string[] | null;
  compliance_flags: string[] | null;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
}

interface Client {
  id: string;
  business_name: string;
  industry: string;
  contact_name: string;
}

interface KnowledgeContextPanelProps {
  client?: Client;
  knowledgeSummary?: KnowledgeSummary | null;
  knowledgeEntries: KnowledgeEntry[];
}

export function KnowledgeContextPanel({ 
  client, 
  knowledgeSummary,
  knowledgeEntries 
}: KnowledgeContextPanelProps) {
  const brandEntries = knowledgeEntries.filter(e => e.category === 'brand');

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Brand Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {client && (
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{client.business_name}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {client.industry}
              </Badge>
            </div>
          )}

          <div className="space-y-4">
            {/* Positioning */}
            {knowledgeSummary?.positioning_summary && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Positioning
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {knowledgeSummary.positioning_summary}
                </p>
              </div>
            )}

            {/* Key Differentiators */}
            {knowledgeSummary?.key_differentiators && knowledgeSummary.key_differentiators.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Key Points
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {knowledgeSummary.key_differentiators.map((diff, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {diff}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ideal Customer */}
            {knowledgeSummary?.ideal_customer_profile && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Target Audience
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {knowledgeSummary.ideal_customer_profile}
                </p>
              </div>
            )}

            {/* Compliance Flags */}
            {knowledgeSummary?.compliance_flags && knowledgeSummary.compliance_flags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Compliance Notes
                  </span>
                </div>
                <div className="space-y-1">
                  {knowledgeSummary.compliance_flags.map((flag, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground bg-yellow-500/10 p-2 rounded">
                      {flag}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Brand Knowledge */}
            {brandEntries.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Brand Knowledge
                  </span>
                </div>
                <div className="space-y-2">
                  {brandEntries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="bg-muted/50 rounded p-2">
                      <p className="text-xs font-medium">{entry.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {entry.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!knowledgeSummary && brandEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No brand context available</p>
                <p className="text-xs mt-1">
                  Add knowledge entries to improve AI generation
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

import { Heart, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAnalytics, ClientHealth } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

function getHealthConfig(score: number) {
  if (score >= 80) return { label: 'Healthy', color: 'text-green-500', bgColor: 'bg-green-500', icon: CheckCircle };
  if (score >= 60) return { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-500', icon: Heart };
  if (score >= 40) return { label: 'At Risk', color: 'text-yellow-500', bgColor: 'bg-yellow-500', icon: AlertTriangle };
  return { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500', icon: TrendingDown };
}

export function ClientHealthCard() {
  const { clientHealth, isLoading } = useAnalytics();

  // Get clients needing attention (lowest health scores)
  const atRiskClients = clientHealth.filter(c => c.healthScore < 60).slice(0, 5);
  const avgHealth = clientHealth.length > 0
    ? Math.round(clientHealth.reduce((sum, c) => sum + c.healthScore, 0) / clientHealth.length)
    : 0;

  const healthConfig = getHealthConfig(avgHealth);
  const HealthIcon = healthConfig.icon;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          Client Health
        </CardTitle>
        <CardDescription>
          Based on content delivery, KPI performance & engagement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", healthConfig.bgColor + '/20')}>
              <HealthIcon className={cn("w-6 h-6", healthConfig.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", healthConfig.color)}>{avgHealth}%</p>
              <p className="text-sm text-muted-foreground">Average health</p>
            </div>
          </div>
          <Badge variant="outline" className={healthConfig.color}>
            {healthConfig.label}
          </Badge>
        </div>

        {atRiskClients.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
            {atRiskClients.map(client => {
              const config = getHealthConfig(client.healthScore);
              return (
                <Link
                  key={client.clientId}
                  to={`/clients/${client.clientId}`}
                  className="flex items-center justify-between p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />
                    <span className="text-sm font-medium text-foreground">{client.businessName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={client.healthScore} className="w-16 h-2" />
                    <span className={cn("text-sm font-medium", config.color)}>{client.healthScore}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {atRiskClients.length === 0 && clientHealth.length > 0 && (
          <div className="text-center py-4 text-green-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">All clients healthy!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

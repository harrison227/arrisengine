import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Phone, ChevronDown } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useClients } from '@/hooks/useClients';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Client = Tables<'clients'>;
type ClientStatus = Client['status'];

interface ClientCardProps {
  client: Client;
}

const statusConfig: Record<ClientStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
  onboarding: { label: 'Onboarding', className: 'bg-primary/10 text-primary border-primary/20' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning border-warning/20' },
  churned: { label: 'Churned', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const statusOptions: ClientStatus[] = ['onboarding', 'active', 'paused', 'churned'];

export function ClientCard({ client }: ClientCardProps) {
  const status = statusConfig[client.status];
  const { updateClient, isUpdating } = useClients();

  const handleStatusChange = (newStatus: ClientStatus) => {
    updateClient({ id: client.id, status: newStatus });
  };

  return (
    <Link 
      to={`/clients/${client.id}`}
      className="bg-card border border-border rounded-xl p-6 block shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {client.business_name}
            </h3>
            {(client as { is_personal?: boolean }).is_personal && (
              <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                Personal
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{client.industry}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <button className="focus:outline-none">
              <Badge className={cn('border cursor-pointer flex items-center gap-1', status.className)}>
                {status.label}
                <ChevronDown className="w-3 h-3" />
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
            {statusOptions.map((statusKey) => (
              <DropdownMenuItem
                key={statusKey}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStatusChange(statusKey);
                }}
                disabled={isUpdating || client.status === statusKey}
                className={cn(
                  client.status === statusKey && 'bg-accent'
                )}
              >
                <Badge className={cn('border', statusConfig[statusKey].className)}>
                  {statusConfig[statusKey].label}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="w-4 h-4" />
          <span>{client.email}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.website && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ExternalLink className="w-4 h-4" />
            <span className="truncate">{client.website}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Monthly Retainer</p>
          <p className="text-xl font-bold text-foreground">${Number(client.mrr).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Contact</p>
          <p className="text-sm font-medium text-foreground">{client.contact_name}</p>
        </div>
      </div>
    </Link>
  );
}

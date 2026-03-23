import { useState } from 'react';
import { ArrowLeft, ExternalLink, Mail, Phone, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EditClientDialog } from '@/components/dialogs/EditClientDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { useClients } from '@/hooks/useClients';

type Client = Tables<'clients'>;
type ClientStatus = Client['status'];

interface ClientHeaderProps {
  client: Client;
}

const statusConfig: Record<ClientStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
  onboarding: { label: 'Onboarding', className: 'bg-primary/10 text-primary border-primary/20' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning border-warning/20' },
  churned: { label: 'Churned', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function ClientHeader({ client }: ClientHeaderProps) {
  const navigate = useNavigate();
  const { deleteClient, isDeleting } = useClients();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  
  const status = statusConfig[client.status];

  const handleDelete = () => {
    deleteClient(client.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate('/clients');
      },
    });
  };

  return (
    <div className="border-b border-border pb-6 mb-6">
      <Link 
        to="/clients" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>
      
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{client.business_name}</h1>
            <Badge className={cn('border', status.className)}>{status.label}</Badge>
          </div>
          <p className="text-muted-foreground">{client.industry}</p>
          
          <div className="flex items-center gap-6 mt-4">
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
              <a 
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Website</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <p className="text-sm text-muted-foreground">Monthly Retainer</p>
            <p className="text-2xl font-bold text-foreground">${Number(client.mrr).toLocaleString()}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Client
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete Client"
        description={`Are you sure you want to delete "${client.business_name}"? This action cannot be undone and will remove all associated data.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}

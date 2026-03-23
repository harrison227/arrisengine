import { useState } from 'react';
import { Plus, Mail, MoreHorizontal, UserCog, Eye, UserMinus, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeam } from '@/hooks/useTeam';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { InviteTeamDialog } from '@/components/dialogs/InviteTeamDialog';
import { useClientAssignments } from '@/hooks/useClientAssignments';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type TeamRole = Database['public']['Enums']['team_role'];

const roleConfig: Record<TeamRole, { label: string; className: string }> = {
  owner: { label: 'Owner', className: 'bg-primary/10 text-primary border-primary/20' },
  admin: { label: 'Admin', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  contractor: { label: 'Contractor', className: 'bg-warning/10 text-warning border-warning/20' },
  editor: { label: 'Editor', className: 'bg-stage-contacted/10 text-stage-contacted border-stage-contacted/20' },
  strategist: { label: 'Strategist', className: 'bg-success/10 text-success border-success/20' },
};

const roles: TeamRole[] = ['owner', 'admin', 'strategist', 'contractor', 'editor'];

export default function Team() {
  const { team, isLoading } = useTeam();
  const { assignments } = useClientAssignments();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getAssignmentsForUser = (userId: string) => {
    return assignments.filter(a => a.user_id === userId);
  };

  const handleChangeRole = async (userId: string, newRole: TeamRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast({ title: 'Role updated successfully' });
    } catch (error: any) {
      toast({ title: 'Failed to update role', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleApproval = async (userId: string, currentlyApproved: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: !currentlyApproved })
        .eq('id', userId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: currentlyApproved ? 'User access revoked' : 'User approved successfully' });
    } catch (error: any) {
      toast({ title: 'Failed to update approval', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members and assignments</p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <Plus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map((member) => {
          const role = member.role ? roleConfig[member.role.role] : { label: 'No Role', className: 'bg-muted text-muted-foreground' };
          const initials = member.profile.full_name 
            ? member.profile.full_name.split(' ').map(n => n[0]).join('')
            : member.profile.email.substring(0, 2).toUpperCase();
          const currentRole = member.role?.role;

          return (
            <div key={member.profile.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {initials}
                    </span>
                  </div>
                   <div>
                    <h3 className="font-semibold text-foreground">
                      {member.profile.full_name || member.profile.email}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className={cn('border', role.className)}>
                        {role.label}
                      </Badge>
                      {!member.profile.is_approved && (
                        <Badge variant="outline" className="border-warning/40 text-warning text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <UserCog className="w-4 h-4 mr-2" />
                        Change Role
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {roles.map(r => (
                          <DropdownMenuItem 
                            key={r}
                            onClick={() => handleChangeRole(member.profile.id, r)}
                            disabled={r === currentRole}
                          >
                            {roleConfig[r].label}
                            {r === currentRole && ' (current)'}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {member.profile.is_approved ? (
                      <DropdownMenuItem
                        onClick={() => handleToggleApproval(member.profile.id, true)}
                        disabled={currentRole === 'owner'}
                      >
                        <ShieldX className="w-4 h-4 mr-2" />
                        Revoke Access
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleToggleApproval(member.profile.id, false)}
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Approve Access
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <Eye className="w-4 h-4 mr-2" />
                      View Assignments
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      disabled={currentRole === 'owner'}
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove from Team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Mail className="w-4 h-4" />
                <span>{member.profile.email}</span>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Assigned Clients</p>
                {(() => {
                  const userAssignments = getAssignmentsForUser(member.profile.id);
                  if (userAssignments.length === 0) {
                    return <p className="text-sm text-muted-foreground">No assignments</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {userAssignments.slice(0, 3).map((a: any) => (
                        <Badge key={a.id} variant="secondary" className="text-xs">
                          {a.client?.business_name || 'Unknown'}
                        </Badge>
                      ))}
                      {userAssignments.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{userAssignments.length - 3}</Badge>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {team.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No team members yet. Invite someone to get started!</p>
          </div>
        )}
      </div>

      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

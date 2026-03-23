import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FilmingDayChangeRequest {
  id: string;
  date: string;
  client_requested_date: string | null;
  client_requested_time: string | null;
  client_change_notes: string | null;
  client_change_requested_at: string | null;
  location: string | null;
  status: string;
}

export function useFilmingDayChangeRequests(clientId?: string) {
  return useQuery({
    queryKey: ['filming-day-change-requests', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('filming_days')
        .select('id, date, client_requested_date, client_requested_time, client_change_notes, client_change_requested_at, location, status')
        .eq('client_id', clientId)
        .eq('client_change_requested', true)
        .order('client_change_requested_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as FilmingDayChangeRequest[];
    },
    enabled: !!clientId,
  });
}

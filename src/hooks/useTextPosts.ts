import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Sydney timezone offset helper - sets time to a specific hour in Sydney timezone
const setToSydneyTime = (date: Date, hour: number, minute: number = 0): Date => {
  // Get the timezone offset for Sydney (Australia/Sydney)
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Get the offset between local time and Sydney time
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  // Create UTC date for specified time in Sydney
  const year = parseInt(getPart('year'));
  const month = parseInt(getPart('month')) - 1;
  const day = parseInt(getPart('day'));
  
  // Check if it's daylight saving time (roughly Oct-Apr)
  const monthNum = date.getMonth();
  const isDST = monthNum >= 9 || monthNum <= 3; // Oct-Apr is DST in Sydney
  const offsetHours = isDST ? 11 : 10;
  
  // Create the final UTC time that represents the specified Sydney time
  const utcHour = hour - offsetHours;
  const finalDate = new Date(Date.UTC(year, month, day, utcHour < 0 ? utcHour + 24 : utcHour, minute, 0, 0));
  
  // If we went negative, we need to go back a day in UTC
  if (utcHour < 0) {
    finalDate.setUTCDate(finalDate.getUTCDate() - 1);
  }
  
  return finalDate;
};

// Generate a random time within a range for Sydney timezone
const getRandomSydneyTimeInRange = (
  date: Date,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): Date => {
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const randomMinutes = Math.floor(Math.random() * (endMinutes - startMinutes + 1)) + startMinutes;
  
  const hours = Math.floor(randomMinutes / 60);
  const minutes = randomMinutes % 60;
  
  return setToSydneyTime(date, hours, minutes);
};

export interface TimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface TextPost {
  id: string;
  user_id: string;
  client_id: string | null;
  platform: string;
  content: string;
  status: 'draft' | 'approved' | 'scheduled' | 'published' | 'pending_review';
  scheduled_date: string | null;
  published_at: string | null;
  guideline_id: string | null;
  session_id: string | null;
  sort_order: number;
  late_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTextPostInput {
  client_id?: string;
  platform: string;
  content: string;
  guideline_id?: string;
  session_id?: string;
  sort_order?: number;
}

export function useTextPosts(platform?: string, clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: textPosts = [], isLoading } = useQuery({
    queryKey: ['text-posts', platform, clientId],
    queryFn: async () => {
      let query = supabase
        .from('text_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (platform) {
        query = query.eq('platform', platform);
      }
      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TextPost[];
    },
    enabled: !!user,
  });

  const createPosts = useMutation({
    mutationFn: async (posts: CreateTextPostInput[]) => {
      if (!user) throw new Error('Not authenticated');

      const postsWithUser = posts.map((post, index) => ({
        ...post,
        user_id: user.id,
        sort_order: post.sort_order ?? index,
      }));

      const { data, error } = await supabase
        .from('text_posts')
        .insert(postsWithUser)
        .select();

      if (error) throw error;
      return data as TextPost[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
    },
    onError: (error) => {
      toast.error('Failed to save posts: ' + error.message);
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TextPost> }) => {
      const { data, error } = await supabase
        .from('text_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TextPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      // REMOVED: Auto-sync to Late on every edit was causing duplicate posts.
      // Sync should only happen via explicit user action (schedulePosts, approvePosts, etc.)
    },
    onError: (error) => {
      toast.error('Failed to update post: ' + error.message);
    },
  });

  const approvePosts = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase
        .from('text_posts')
        .update({ status: 'approved' })
        .in('id', ids)
        .select();

      if (error) throw error;
      return data as TextPost[];
    },
    onSuccess: async (posts) => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      toast.success('Posts approved');
      
      // Sync approved posts to Late (only those with scheduled_date and NOT already synced)
      const postsToSync = posts.filter(p => p.scheduled_date && !p.late_post_id);
      if (postsToSync.length > 0) {
        const syncPromises = postsToSync.map(post =>
          supabase.functions.invoke('sync-text-to-late', {
            body: { textPostId: post.id, action: 'create' },
          }).catch(err => console.error('Late sync failed for', post.id, err))
        );
        await Promise.allSettled(syncPromises);
      }
    },
    onError: (error) => {
      toast.error('Failed to approve posts: ' + error.message);
    },
  });

  const schedulePosts = useMutation({
    mutationFn: async (postsWithDates: { id: string; scheduled_date: string; status?: 'scheduled' | 'pending_review' }[]) => {
      const promises = postsWithDates.map(({ id, scheduled_date, status = 'scheduled' }) =>
        supabase
          .from('text_posts')
          .update({ status, scheduled_date })
          .eq('id', id)
          .select()
          .single()
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error('Some posts failed to schedule');
      }
      
      return results.map(r => r.data as TextPost);
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      toast.success('Posts added to calendar');
      
      // Sync scheduled posts to Late (only those NOT already synced)
      const syncPromises = data
        .filter(post => post.status === 'scheduled' && !post.late_post_id)
        .map(post => 
          supabase.functions.invoke('sync-text-to-late', {
            body: { textPostId: post.id, action: 'create' },
          }).catch(err => console.error('Late sync failed for', post.id, err))
        );
      
      await Promise.allSettled(syncPromises);
    },
    onError: (error) => {
      toast.error('Failed to schedule posts: ' + error.message);
    },
  });

  const deletePosts = useMutation({
    mutationFn: async (ids: string[]) => {
      // First, get the posts to check if they have late_post_ids
      const { data: postsToDelete } = await supabase
        .from('text_posts')
        .select('id, late_post_id, status')
        .in('id', ids);
      
      // Delete from Late first for any synced posts
      const syncedPosts = postsToDelete?.filter(p => p.late_post_id) || [];
      if (syncedPosts.length > 0) {
        await Promise.allSettled(
          syncedPosts.map(post =>
            supabase.functions.invoke('sync-text-to-late', {
              body: { textPostId: post.id, action: 'delete' },
            })
          )
        );
      }
      
      // Then delete from database
      const { error } = await supabase
        .from('text_posts')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      toast.success('Posts deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete posts: ' + error.message);
    },
  });

  // Bulk update status for multiple posts
  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: TextPost['status'] }) => {
      // First get current state of posts to check for late_post_id
      const { data: posts } = await supabase
        .from('text_posts')
        .select('id, late_post_id, scheduled_date')
        .in('id', ids);

      const { error } = await supabase
        .from('text_posts')
        .update({ status })
        .in('id', ids);

      if (error) throw error;
      
      return { posts: posts || [], newStatus: status };
    },
    onSuccess: async ({ posts, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      toast.success('Posts updated');
      
      // Sync to Late ONLY for posts that are newly scheduled AND don't have late_post_id
      const postsToSync = posts.filter(p => 
        newStatus === 'scheduled' && !p.late_post_id && p.scheduled_date
      );
      
      if (postsToSync.length > 0) {
        const syncPromises = postsToSync.map(post =>
          supabase.functions.invoke('sync-text-to-late', {
            body: { textPostId: post.id, action: 'create' },
          }).catch(err => console.error('Late sync failed for', post.id, err))
        );
        await Promise.allSettled(syncPromises);
      }
    },
    onError: (error) => {
      toast.error('Failed to update posts: ' + error.message);
    },
  });

  const getAvailableDates = async (
    startDate: Date, 
    days: number, 
    clientId?: string,
    timeRange?: TimeRange
  ): Promise<Date[]> => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    // Fetch scheduled content pieces
    let contentQuery = supabase
      .from('content_pieces')
      .select('scheduled_date, content_plan_id, content_plans!inner(client_id)')
      .gte('scheduled_date', startDate.toISOString())
      .lt('scheduled_date', endDate.toISOString())
      .not('scheduled_date', 'is', null);

    if (clientId) {
      contentQuery = contentQuery.eq('content_plans.client_id', clientId);
    }

    // Fetch scheduled text posts
    let textPostsQuery = supabase
      .from('text_posts')
      .select('scheduled_date')
      .eq('status', 'scheduled')
      .gte('scheduled_date', startDate.toISOString())
      .lt('scheduled_date', endDate.toISOString());

    if (clientId) {
      textPostsQuery = textPostsQuery.eq('client_id', clientId);
    }

    const [contentResult, textPostsResult] = await Promise.all([
      contentQuery,
      textPostsQuery,
    ]);

    const occupiedDates = new Set<string>();

    contentResult.data?.forEach((item) => {
      if (item.scheduled_date) {
        occupiedDates.add(new Date(item.scheduled_date).toDateString());
      }
    });

    textPostsResult.data?.forEach((item) => {
      if (item.scheduled_date) {
        occupiedDates.add(new Date(item.scheduled_date).toDateString());
      }
    });

    const availableDates: Date[] = [];
    const currentDate = new Date(startDate);

    // Default to 10am if no time range provided
    const defaultTimeRange: TimeRange = {
      startHour: 10,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
    };
    const range = timeRange || defaultTimeRange;

    while (currentDate < endDate) {
      if (!occupiedDates.has(currentDate.toDateString())) {
        // Use random time within range if different start/end, otherwise use exact time
        if (range.startHour === range.endHour && range.startMinute === range.endMinute) {
          availableDates.push(setToSydneyTime(new Date(currentDate), range.startHour, range.startMinute));
        } else {
          availableDates.push(
            getRandomSydneyTimeInRange(
              new Date(currentDate),
              range.startHour,
              range.startMinute,
              range.endHour,
              range.endMinute
            )
          );
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableDates;
  };

  return {
    textPosts,
    isLoading,
    createPosts,
    updatePost,
    approvePosts,
    schedulePosts,
    deletePosts,
    bulkUpdateStatus,
    getAvailableDates,
  };
}

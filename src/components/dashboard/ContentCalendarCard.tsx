import { Calendar, Video, Image, FileText, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const contentTypeIcons: Record<string, typeof Video> = {
  video: Video,
  image: Image,
  carousel: Image,
  story: Video,
  reel: Video,
  ugc: Video,
  text: MessageSquare,
};

interface CalendarItem {
  id: string;
  title: string;
  type: 'content_plan' | 'text_post';
  client_id: string;
  client_name?: string;
  status: string;
  platform?: string;
}

export function ContentCalendarCard() {
  const { user } = useAuth();

  const { data: upcomingContent = [], isLoading } = useQuery({
    queryKey: ['upcoming-content', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const now = new Date();
      const weekFromNow = addDays(now, 7);

      // Get content plans with filming dates in next 7 days
      const { data: plans, error: plansError } = await supabase
        .from('content_plans')
        .select(`
          id,
          title,
          filming_date,
          status,
          client_id,
          clients(business_name)
        `)
        .gte('filming_date', format(now, 'yyyy-MM-dd'))
        .lte('filming_date', format(weekFromNow, 'yyyy-MM-dd'))
        .order('filming_date', { ascending: true });

      if (plansError) throw plansError;

      // Get scheduled text posts in next 7 days
      const { data: textPosts, error: textPostsError } = await supabase
        .from('text_posts')
        .select(`
          id,
          platform,
          content,
          scheduled_date,
          status,
          client_id,
          clients(business_name)
        `)
        .eq('status', 'scheduled')
        .gte('scheduled_date', format(now, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekFromNow, 'yyyy-MM-dd'))
        .order('scheduled_date', { ascending: true });

      if (textPostsError) throw textPostsError;

      // Combine and group by date
      const dateGroups: Record<string, CalendarItem[]> = {};

      // Add content plans
      (plans || []).forEach(plan => {
        const date = plan.filming_date!;
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push({
          id: plan.id,
          title: plan.title,
          type: 'content_plan',
          client_id: plan.client_id,
          client_name: (plan.clients as { business_name: string } | null)?.business_name,
          status: plan.status,
        });
      });

      // Add text posts
      (textPosts || []).forEach(post => {
        const date = post.scheduled_date!.split('T')[0];
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push({
          id: post.id,
          title: post.content.slice(0, 50) + (post.content.length > 50 ? '...' : ''),
          type: 'text_post',
          client_id: post.client_id,
          client_name: (post.clients as { business_name: string } | null)?.business_name,
          status: post.status,
          platform: post.platform,
        });
      });

      // Sort by date
      return Object.entries(dateGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, items]) => ({
          date,
          items,
        }));
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Content Calendar
        </CardTitle>
        <CardDescription>Next 7 days at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingContent.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No content scheduled this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingContent.slice(0, 4).map(({ date, items }) => {
              const dateObj = parseISO(date);
              const isToday = format(new Date(), 'yyyy-MM-dd') === date;
              
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "text-xs font-medium px-2 py-1 rounded",
                      isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {isToday ? 'Today' : format(dateObj, 'EEE, MMM d')}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const Icon = item.type === 'text_post' 
                        ? MessageSquare 
                        : contentTypeIcons.video;
                      
                      return (
                        <Link
                          key={`${item.type}-${item.id}`}
                          to={`/clients/${item.client_id}`}
                          className="flex items-center justify-between p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-foreground line-clamp-1">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1">
                                <p className="text-xs text-muted-foreground">
                                  {item.client_name}
                                </p>
                                {item.platform && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {item.platform}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.status}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

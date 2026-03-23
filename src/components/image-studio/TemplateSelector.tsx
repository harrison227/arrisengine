import { Quote, BarChart3, Megaphone, MessageSquareQuote, BookOpen, Camera, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const templates = [
  {
    id: 'quote_card',
    label: 'Quote Card',
    description: 'Inspirational or educational quotes',
    icon: Quote,
  },
  {
    id: 'stat_graphic',
    label: 'Stat Graphic',
    description: 'Key statistics and results',
    icon: BarChart3,
  },
  {
    id: 'announcement',
    label: 'Announcement',
    description: 'New product or service launch',
    icon: Megaphone,
  },
  {
    id: 'testimonial',
    label: 'Testimonial',
    description: 'Customer quotes and reviews',
    icon: MessageSquareQuote,
  },
  {
    id: 'tips_carousel',
    label: 'Tips/Educational',
    description: 'Educational content slides',
    icon: BookOpen,
  },
  {
    id: 'behind_the_scenes',
    label: 'Behind the Scenes',
    description: 'Authentic, casual content',
    icon: Camera,
  },
  {
    id: 'promotional',
    label: 'Promotional',
    description: 'Offers and sales posts',
    icon: Tag,
  },
];

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {templates.map((template) => {
        const Icon = template.icon;
        const isSelected = value === template.id;
        
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={cn(
              'flex flex-col items-center p-4 rounded-lg border-2 transition-all text-center',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted'
            )}
          >
            <Icon className={cn(
              'h-6 w-6 mb-2',
              isSelected ? 'text-primary' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-sm font-medium',
              isSelected ? 'text-primary' : 'text-foreground'
            )}>
              {template.label}
            </span>
            <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

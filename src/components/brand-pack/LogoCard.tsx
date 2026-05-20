/**
 * Logo card. Shows a logo on light + dark backgrounds, with download / set
 * primary / delete buttons. Used inside the Brand Pack tab.
 */

import { Star, Download, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClientLogo } from '@/types/brand-pack';
import { LOGO_BACKGROUND_LABELS, LOGO_VARIANT_LABELS } from '@/types/brand-pack';

interface LogoCardProps {
  logo: ClientLogo;
  onDelete?: (id: string) => void;
  onSetPrimary?: (id: string) => void;
  /** When true, hides the management menu (used on the public share page). */
  readOnly?: boolean;
}

const BACKGROUND_PREVIEW_CLASSES: Record<ClientLogo['background_treatment'], string> = {
  light: 'bg-white',
  dark: 'bg-zinc-900',
  color: 'bg-primary/10',
  transparent: 'bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]',
};

export function LogoCard({ logo, onDelete, onSetPrimary, readOnly }: LogoCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={`relative h-40 flex items-center justify-center ${BACKGROUND_PREVIEW_CLASSES[logo.background_treatment]}`}>
        <img
          src={logo.file_url}
          alt={logo.label}
          className="max-w-[80%] max-h-[80%] object-contain"
        />
        {logo.is_primary && (
          <Badge className="absolute top-2 left-2" variant="default">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Primary
          </Badge>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{logo.label}</div>
            <div className="text-xs text-muted-foreground">
              {LOGO_VARIANT_LABELS[logo.variant]} · {LOGO_BACKGROUND_LABELS[logo.background_treatment]}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              asChild
            >
              <a href={logo.file_url} download={logo.label} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!logo.is_primary && onSetPrimary && (
                    <DropdownMenuItem onClick={() => onSetPrimary(logo.id)}>
                      <Star className="h-4 w-4 mr-2" />
                      Mark as primary
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(logo.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {logo.notes && <p className="text-xs text-muted-foreground">{logo.notes}</p>}
      </div>
    </div>
  );
}

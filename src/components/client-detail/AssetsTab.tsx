import { useState, useRef } from 'react';
import { Plus, Trash2, Upload, File, Image, FileText, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssets } from '@/hooks/useAssets';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type AssetType = Database['public']['Enums']['asset_type'];

interface AssetsTabProps {
  clientId: string;
}

const assetTypeConfig: Record<AssetType, { icon: typeof File; label: string }> = {
  logo: { icon: Image, label: 'Logo' },
  guidelines: { icon: FileText, label: 'Guidelines' },
  footage: { icon: Video, label: 'Footage' },
  creative: { icon: Image, label: 'Creative' },
  document: { icon: FileText, label: 'Document' },
};

const handleOpenAsset = (url: string | null, e: React.MouseEvent) => {
  e.stopPropagation();
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export function AssetsTab({ clientId }: AssetsTabProps) {
  const { assets, isLoading, uploadAsset, deleteAsset, isDeleting } = useAssets(clientId);
  const [isUploading, setIsUploading] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<typeof assets[0] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      // Determine asset type based on file extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      let assetType: AssetType = 'document';
      
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
        assetType = 'creative';
      } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
        assetType = 'footage';
      } else if (['pdf'].includes(ext || '')) {
        assetType = 'guidelines';
      }
      
      await uploadAsset(file, clientId, assetType);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Asset Library</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Asset
              </>
            )}
          </Button>
        </div>
      </div>

      {assets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const config = assetTypeConfig[asset.asset_type];
            const Icon = config.icon;
            const isImage = ['logo', 'creative'].includes(asset.asset_type);
            
            return (
              <div
                key={asset.id}
                className="bg-card border border-border rounded-xl p-4 group relative shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                onClick={(e) => handleOpenAsset(asset.thumbnail_url, e)}
              >
                <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                  {isImage && asset.thumbnail_url ? (
                    <img 
                      src={asset.thumbnail_url} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
                
                {/* Open in new tab button */}
                <button
                  onClick={(e) => handleOpenAsset(asset.thumbnail_url, e)}
                  className="absolute top-2 left-2 p-1.5 rounded-md bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssetToDelete(asset);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Assets Yet</h3>
          <p className="text-muted-foreground mb-4">Upload logos, brand guidelines, footage, and more</p>
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Plus className="w-4 h-4" />
            Upload First Asset
          </Button>
        </div>
      )}

      <AlertDialog open={!!assetToDelete} onOpenChange={() => setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (assetToDelete) {
                  deleteAsset(assetToDelete);
                  setAssetToDelete(null);
                }
              }}
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Video, Loader2, Sparkles, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractAudioFromVideo } from '@/lib/audioExtractor';

interface MediaUploaderProps {
  clientId: string;
  value?: string;
  onChange: (url: string | null) => void;
  onVideoTranscribed?: (transcript: string) => void;
  multiple?: boolean;
  multipleValues?: string[];
  onMultipleChange?: (urls: string[]) => void;
}

export function MediaUploader({ clientId, value, onChange, onVideoTranscribed, multiple, multipleValues, onMultipleChange }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const transcribeVideoFromFile = async (videoFile: File) => {
    if (!onVideoTranscribed) return;
    
    setIsTranscribing(true);
    setTranscriptionStatus('Extracting audio from video...');
    
    try {
      const audioBlob = await extractAudioFromVideo(videoFile);
      
      const audioSizeMB = audioBlob.size / 1024 / 1024;
      console.log(`Audio extracted: ${audioSizeMB.toFixed(2)}MB`);
      
      if (audioSizeMB > 25) {
        toast({
          title: 'Audio too large',
          description: 'Extracted audio exceeds 25MB. Caption will need to be written manually.',
        });
        return;
      }
      
      setTranscriptionStatus('Transcribing audio...');
      
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { 
          audioBase64: base64Audio,
          mimeType: audioBlob.type
        }
      });
      
      if (error) throw error;
      
      if (data.warning) {
        toast({
          title: 'Transcription limited',
          description: data.warning,
        });
      }
      
      if (data.transcript && data.transcript.trim()) {
        onVideoTranscribed(data.transcript);
        toast({ title: 'Video transcribed!', description: 'Caption will be generated from audio.' });
      } else if (!data.warning) {
        toast({
          title: 'No speech detected',
          description: 'The video appears to have no spoken audio.',
        });
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: 'Transcription failed',
        description: 'Could not transcribe video audio. You can still write a caption manually.',
        variant: 'destructive'
      });
    } finally {
      setIsTranscribing(false);
      setTranscriptionStatus('');
    }
  };

  const uploadSingleFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image or video', variant: 'destructive' });
      return null;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 500MB', variant: 'destructive' });
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('client-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('client-assets')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const publicUrl = await uploadSingleFile(file);
      if (!publicUrl) return;

      onChange(publicUrl);
      setUploadProgress(100);
      toast({ title: 'Media uploaded successfully' });

      if (file.type.startsWith('video/') && onVideoTranscribed) {
        await transcribeVideoFromFile(file);
      }
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const uploadMultipleFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({ title: 'No images selected', description: 'Please upload image files for carousel', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const existingUrls = multipleValues || [];
      const totalFiles = imageFiles.length;
      const newUrls: string[] = [];

      for (let i = 0; i < totalFiles; i++) {
        const url = await uploadSingleFile(imageFiles[i]);
        if (url) newUrls.push(url);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      const allUrls = [...existingUrls, ...newUrls];
      onMultipleChange?.(allUrls);
      toast({ title: `${newUrls.length} image${newUrls.length > 1 ? 's' : ''} uploaded` });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (multiple) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) uploadMultipleFiles(files);
    } else {
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    }
  }, [clientId, multiple, multipleValues]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (multiple) {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) uploadMultipleFiles(files);
    } else {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  const handleRemoveFromMultiple = (index: number) => {
    if (!multipleValues) return;
    const updated = multipleValues.filter((_, i) => i !== index);
    onMultipleChange?.(updated);
  };

  // Multiple mode rendering
  if (multiple) {
    const urls = multipleValues || [];

    return (
      <div className="space-y-3">
        {urls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {urls.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt={`Slide ${i + 1}`}
                  className="h-24 w-24 rounded-lg object-cover border border-border"
                />
                <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-tl-lg rounded-br-lg font-medium">
                  {i + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFromMultiple(i)}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            isUploading && 'pointer-events-none opacity-60'
          )}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center gap-1.5">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 text-primary">
                  <Plus className="w-4 h-4" />
                  <span className="font-medium text-sm">
                    {urls.length > 0 ? 'Add more images' : 'Upload images'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select multiple images for carousel (max 500MB each)
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Single mode rendering (original behavior)
  const isVideo = value?.match(/\.(mp4|mov|webm|avi)$/i);

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/30">
        {isVideo ? (
          <video 
            src={value} 
            controls 
            className="w-full max-h-64 object-contain bg-black"
          />
        ) : (
          <img 
            src={value} 
            alt="Uploaded media" 
            className="w-full max-h-64 object-contain"
          />
        )}
        {isTranscribing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm font-medium">{transcriptionStatus || 'Processing...'}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleRemove}
          disabled={isTranscribing}
          className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        isUploading && 'pointer-events-none opacity-60'
      )}
    >
      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isUploading}
      />
      
      <div className="flex flex-col items-center gap-2">
        {isUploading ? (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ImageIcon className="w-8 h-8" />
              <Video className="w-8 h-8" />
            </div>
            <div className="flex items-center gap-1 text-primary">
              <Upload className="w-4 h-4" />
              <span className="font-medium">Click or drag to upload</span>
            </div>
            <p className="text-sm text-muted-foreground">Image or Video (max 500MB)</p>
            {onVideoTranscribed && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Sparkles className="w-3 h-3" />
                <span>Videos will be auto-transcribed for caption generation</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

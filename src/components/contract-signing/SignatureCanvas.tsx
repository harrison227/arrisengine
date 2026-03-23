import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser, PenTool, Type } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureChange: (data: string, type: 'draw' | 'type') => void;
}

export function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedSignature, setTypedSignature] = useState('');
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // Configure drawing style
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    onSignatureChange(dataUrl, 'draw');
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureChange('', 'draw');
  };

  const handleTypedSignatureChange = (value: string) => {
    setTypedSignature(value);
    if (value.trim()) {
      // Create a canvas with the typed signature
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'italic 32px "Brush Script MT", cursive, serif';
        ctx.fillStyle = '#1e293b';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, 20, 50);
        onSignatureChange(canvas.toDataURL('image/png'), 'type');
      }
    } else {
      onSignatureChange('', 'type');
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'draw' | 'type')}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="draw" className="flex items-center gap-2">
          <PenTool className="w-4 h-4" />
          Draw
        </TabsTrigger>
        <TabsTrigger value="type" className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          Type
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="draw" className="space-y-3">
        <div className="border rounded-lg bg-white relative">
          <canvas
            ref={canvasRef}
            className="w-full h-32 cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <div className="absolute bottom-2 left-2 right-2 border-t border-dashed border-muted-foreground/30" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="w-full"
        >
          <Eraser className="w-4 h-4 mr-2" />
          Clear Signature
        </Button>
      </TabsContent>
      
      <TabsContent value="type" className="space-y-3">
        <Input
          placeholder="Type your full name"
          value={typedSignature}
          onChange={(e) => handleTypedSignatureChange(e.target.value)}
          className="text-xl italic"
          style={{ fontFamily: '"Brush Script MT", cursive, serif' }}
        />
        {typedSignature && (
          <div className="border rounded-lg bg-white p-4 text-center">
            <span 
              className="text-3xl text-slate-800"
              style={{ fontFamily: '"Brush Script MT", cursive, serif' }}
            >
              {typedSignature}
            </span>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

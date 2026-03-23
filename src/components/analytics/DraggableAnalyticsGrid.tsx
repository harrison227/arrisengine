import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ModuleConfig {
  id: string;
  title: string;
  component: React.ReactNode;
}

interface SortableModuleProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

const STORAGE_KEY = 'analytics-module-order';
const DEFAULT_ORDER = ['platform-cards', 'overview-cards', 'follower-chart', 'platform-breakdown', 'top-posts'];

function SortableModule({ id, title, children }: SortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 p-2 rounded-md bg-muted/80 hover:bg-muted"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className={isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}>
        {children}
      </div>
    </div>
  );
}

interface DraggableAnalyticsGridProps {
  modules: ModuleConfig[];
}

export function DraggableAnalyticsGrid({ modules }: DraggableAnalyticsGridProps) {
  const [moduleOrder, setModuleOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that saved order contains all current module ids
        const moduleIds = modules.map(m => m.id);
        if (moduleIds.every(id => parsed.includes(id)) && parsed.length === moduleIds.length) {
          return parsed;
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return modules.map(m => m.id);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(moduleOrder));
  }, [moduleOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setModuleOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleReset = () => {
    setModuleOrder(DEFAULT_ORDER);
  };

  const orderedModules = moduleOrder
    .map(id => modules.find(m => m.id === id))
    .filter(Boolean) as ModuleConfig[];

  const isDefaultOrder = JSON.stringify(moduleOrder) === JSON.stringify(DEFAULT_ORDER);

  return (
    <div className="space-y-4">
      {!isDefaultOrder && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Layout
          </Button>
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={moduleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6 pl-6">
            {orderedModules.map((module) => (
              <SortableModule key={module.id} id={module.id} title={module.title}>
                {module.component}
              </SortableModule>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

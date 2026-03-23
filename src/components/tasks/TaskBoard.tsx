import { useState } from 'react';
import { format, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { 
  CheckSquare, Plus, Calendar, Flag, User, Building2, 
  MoreHorizontal, Trash2, Edit2, GripVertical, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useTasks, Task, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { useTeam } from '@/hooks/useTeam';
import { cn } from '@/lib/utils';

const statusColumns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500/20' },
  { id: 'review', label: 'Review', color: 'bg-yellow-500/20' },
  { id: 'complete', label: 'Complete', color: 'bg-green-500/20' },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-blue-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
];

interface TaskBoardProps {
  clientId?: string;
}

export default function TaskBoard({ clientId }: TaskBoardProps) {
  const { tasks, isLoading, createTask, updateTaskStatus, deleteTask, isCreating } = useTasks(clientId);
  const { clients } = useClients();
  const { team } = useTeam();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    due_date: null as Date | null,
    client_id: clientId || null as string | null,
    assigned_to: null as string | null,
  });

  const resetForm = () => {
    setTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      due_date: null,
      client_id: clientId || null,
      assigned_to: null,
    });
    setEditingTask(null);
  };

  const handleSubmit = () => {
    createTask({
      title: taskForm.title,
      description: taskForm.description || null,
      priority: taskForm.priority,
      due_date: taskForm.due_date ? format(taskForm.due_date, 'yyyy-MM-dd') : null,
      client_id: taskForm.client_id,
      assigned_to: taskForm.assigned_to,
      status: 'todo',
      is_recurring: false,
      recurrence_pattern: null,
      parent_task_id: null,
      content_plan_id: null,
    });
    setDialogOpen(false);
    resetForm();
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateTaskStatus({ id: taskId, status });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  const getDueDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return { label: 'Overdue', className: 'text-red-500 bg-red-500/10' };
    if (isToday(date)) return { label: 'Today', className: 'text-orange-500 bg-orange-500/10' };
    if (isTomorrow(date)) return { label: 'Tomorrow', className: 'text-yellow-500 bg-yellow-500/10' };
    return { label: format(date, 'MMM d'), className: 'text-muted-foreground bg-muted' };
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          Tasks
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Task title..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Task details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={taskForm.priority}
                    onValueChange={(value: TaskPriority) => setTaskForm({ ...taskForm, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className={opt.color}>{opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="w-4 h-4 mr-2" />
                        {taskForm.due_date ? format(taskForm.due_date, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={taskForm.due_date || undefined}
                        onSelect={(date) => setTaskForm({ ...taskForm, due_date: date || null })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {!clientId && (
                <div className="space-y-2">
                  <Label>Client (optional)</Label>
                  <Select
                    value={taskForm.client_id || 'none'}
                    onValueChange={(value) => setTaskForm({ ...taskForm, client_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.business_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Assign to (optional)</Label>
                <Select
                  value={taskForm.assigned_to || 'none'}
                  onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {team.map(member => (
                      <SelectItem key={member.profile.id} value={member.profile.id}>
                        {member.profile.full_name || member.profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSubmit} disabled={!taskForm.title || isCreating} className="w-full">
                {isCreating ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {statusColumns.map(column => (
          <div
            key={column.id}
            className={cn("rounded-lg p-3 min-h-[400px]", column.color)}
            onDrop={(e) => handleDrop(e, column.id)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-foreground">{column.label}</h3>
              <Badge variant="secondary" className="text-xs">
                {getTasksByStatus(column.id).length}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {getTasksByStatus(column.id).map(task => {
                const priority = priorityOptions.find(p => p.value === task.priority);
                const dueLabel = getDueDateLabel(task.due_date);
                
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className="bg-background border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => deleteTask(task.id)}>
                            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {priority && (
                        <Badge variant="outline" className={cn("text-xs", priority.color)}>
                          <Flag className="w-3 h-3 mr-1" />
                          {priority.label}
                        </Badge>
                      )}
                      {dueLabel && (
                        <Badge variant="outline" className={cn("text-xs", dueLabel.className)}>
                          <Clock className="w-3 h-3 mr-1" />
                          {dueLabel.label}
                        </Badge>
                      )}
                      {task.clients?.business_name && (
                        <Badge variant="secondary" className="text-xs">
                          <Building2 className="w-3 h-3 mr-1" />
                          {task.clients.business_name}
                        </Badge>
                      )}
                    </div>
                    
                    {task.profiles && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{task.profiles.full_name || task.profiles.email}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {getTasksByStatus(column.id).length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

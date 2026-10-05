'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/components/tasks/task-badges';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { useDialogState } from '@/lib/use-dialog-state';
import { taskFormSchema, type TaskFormValues } from '@/lib/validations/forms';

export interface ProjectOption {
  id: string;
  name: string;
  color: string | null;
}

export interface TaskDialogTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskFormValues['status'];
  priority: TaskFormValues['priority'];
  dueDate: string | Date | null;
  projectId: string | null;
}

export interface TaskDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectOptions: ProjectOption[];
  /** Omit to create; pass a task to edit it. */
  task?: TaskDialogTask;
  /** Pre-selected project when creating from a project page. */
  defaultProjectId?: string;
}

const NO_PROJECT = '__none__';

function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function TaskDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  projectOptions,
  task,
  defaultProjectId,
}: TaskDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(task);

  const defaults: TaskFormValues = {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'TODO',
    priority: task?.priority ?? 'MEDIUM',
    dueDate: toDateInputValue(task?.dueDate),
    projectId: task?.projectId ?? defaultProjectId ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: defaults });

  // Re-seed the form each time the dialog opens so stale edits never persist.
  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: TaskFormValues) {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate || undefined,
      projectId: values.projectId || (isEdit ? null : undefined),
    };

    try {
      if (isEdit && task) await api.patch(`/api/tasks/${task.id}`, payload);
      else await api.post('/api/tasks', payload);

      toast({ title: isEdit ? 'Task updated' : 'Task created', variant: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the task',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details of this task.'
              : 'Capture something you need to get done.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="task-title" error={errors.title?.message} required>
            <Input
              id="task-title"
              placeholder="Write the migration guide"
              aria-invalid={Boolean(errors.title)}
              {...register('title')}
            />
          </Field>

          <Field label="Description" htmlFor="task-description" error={errors.description?.message}>
            <Textarea
              id="task-description"
              rows={3}
              placeholder="Optional context, links or acceptance criteria."
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" error={errors.status?.message}>
              <Select
                value={watch('status')}
                onValueChange={(value) =>
                  setValue('status', value as TaskFormValues['status'], { shouldDirty: true })
                }
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority" error={errors.priority?.message}>
              <Select
                value={watch('priority')}
                onValueChange={(value) =>
                  setValue('priority', value as TaskFormValues['priority'], { shouldDirty: true })
                }
              >
                <SelectTrigger aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Due date" htmlFor="task-due" error={errors.dueDate?.message}>
              <Input id="task-due" type="date" {...register('dueDate')} />
            </Field>

            <Field label="Project" error={errors.projectId?.message}>
              <Select
                value={watch('projectId') || NO_PROJECT}
                onValueChange={(value) =>
                  setValue('projectId', value === NO_PROJECT ? '' : value, { shouldDirty: true })
                }
              >
                <SelectTrigger aria-label="Project">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>No project</SelectItem>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

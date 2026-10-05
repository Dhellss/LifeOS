'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { PROJECT_STATUS_LABELS } from '@/components/projects/project-badges';
import { ColorPicker } from '@/components/shared/color-picker';
import { Field } from '@/components/shared/form-field';
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
import { projectFormSchema, type ProjectFormValues } from '@/lib/validations/forms';

export interface ProjectDialogProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectFormValues['status'];
  color: string | null;
  startDate: string | Date | null;
  targetDate: string | Date | null;
}

export interface ProjectDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  project?: ProjectDialogProject;
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function ProjectDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  project,
}: ProjectDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(project);

  const defaults: ProjectFormValues = {
    name: project?.name ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'ACTIVE',
    color: project?.color ?? '',
    startDate: toDateInput(project?.startDate),
    targetDate: toDateInput(project?.targetDate),
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: ProjectFormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      status: values.status,
      color: values.color || undefined,
      startDate: values.startDate || undefined,
      targetDate: values.targetDate || undefined,
    };

    try {
      if (isEdit && project) await api.patch(`/api/projects/${project.id}`, payload);
      else await api.post('/api/projects', payload);

      toast({ title: isEdit ? 'Project updated' : 'Project created', variant: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the project',
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
          <DialogTitle>{isEdit ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            Progress is calculated from the tasks linked to this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="project-name" error={errors.name?.message} required>
            <Input
              id="project-name"
              placeholder="Portfolio rebuild"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="project-description"
            error={errors.description?.message}
          >
            <Textarea
              id="project-description"
              rows={3}
              placeholder="What does done look like?"
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="project-start" error={errors.startDate?.message}>
              <Input id="project-start" type="date" {...register('startDate')} />
            </Field>
            <Field label="Target date" htmlFor="project-target" error={errors.targetDate?.message}>
              <Input id="project-target" type="date" {...register('targetDate')} />
            </Field>
          </div>

          <Field label="Status" error={errors.status?.message}>
            <Select
              value={watch('status')}
              onValueChange={(value) =>
                setValue('status', value as ProjectFormValues['status'], { shouldDirty: true })
              }
            >
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Colour" error={errors.color?.message}>
            <ColorPicker
              value={watch('color')}
              onChange={(value) => setValue('color', value, { shouldDirty: true })}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

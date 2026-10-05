'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { EVENT_TYPE_LABELS } from '@/components/calendar/event-type';
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
import { SwitchField } from '@/components/ui/switch-field';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { useDialogState } from '@/lib/use-dialog-state';
import { eventFormSchema, type EventFormValues } from '@/lib/validations/forms';

export interface EventDialogEvent {
  id: string;
  title: string;
  description: string | null;
  type: EventFormValues['type'];
  startTime: string | Date;
  endTime: string | Date | null;
  location: string | null;
  allDay: boolean;
}

export interface EventDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  event?: EventDialogEvent;
  /** `yyyy-MM-dd` seed when creating from a clicked calendar cell. */
  defaultDay?: string;
}

/** `<input type="datetime-local">` needs a local `yyyy-MM-ddTHH:mm` value. */
function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function defaultStart(day?: string): string {
  const base = day ? new Date(`${day}T09:00:00`) : new Date();
  if (!day) base.setMinutes(0, 0, 0);
  return toLocalInput(base);
}

export function EventDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  event,
  defaultDay,
}: EventDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(event);

  const defaults: EventFormValues = {
    title: event?.title ?? '',
    description: event?.description ?? '',
    type: event?.type ?? 'PERSONAL',
    startTime: event ? toLocalInput(event.startTime) : defaultStart(defaultDay),
    endTime: event ? toLocalInput(event.endTime) : '',
    location: event?.location ?? '',
    allDay: event?.allDay ?? false,
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDay]);

  async function onSubmit(values: EventFormValues) {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      type: values.type,
      startTime: new Date(values.startTime).toISOString(),
      endTime: values.endTime ? new Date(values.endTime).toISOString() : undefined,
      location: values.location || undefined,
      allDay: values.allDay,
    };

    try {
      if (isEdit && event) await api.patch(`/api/calendar/${event.id}`, payload);
      else await api.post('/api/calendar', payload);

      toast({ title: isEdit ? 'Event updated' : 'Event created', variant: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the event',
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
          <DialogTitle>{isEdit ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>Events show up on your calendar and dashboard.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="event-title" error={errors.title?.message} required>
            <Input
              id="event-title"
              placeholder="Algorithms lecture"
              aria-invalid={Boolean(errors.title)}
              {...register('title')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="event-start" error={errors.startTime?.message} required>
              <Input id="event-start" type="datetime-local" {...register('startTime')} />
            </Field>
            <Field label="Ends" htmlFor="event-end" error={errors.endTime?.message}>
              <Input id="event-end" type="datetime-local" {...register('endTime')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={errors.type?.message}>
              <Select
                value={watch('type')}
                onValueChange={(value) =>
                  setValue('type', value as EventFormValues['type'], { shouldDirty: true })
                }
              >
                <SelectTrigger aria-label="Event type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location" htmlFor="event-location" error={errors.location?.message}>
              <Input id="event-location" placeholder="Room B2 / online" {...register('location')} />
            </Field>
          </div>

          <SwitchField
            label="All day"
            hint="Hides the time on the calendar and agenda."
            {...register('allDay')}
          />

          <Field
            label="Description"
            htmlFor="event-description"
            error={errors.description?.message}
          >
            <Textarea id="event-description" rows={3} {...register('description')} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

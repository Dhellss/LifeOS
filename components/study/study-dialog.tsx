'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { useDialogState } from '@/lib/use-dialog-state';
import { studyFormSchema, type StudyFormValues } from '@/lib/validations/forms';

export interface StudyDialogSession {
  id: string;
  subject: string;
  topic: string | null;
  durationMinutes: number;
  notes: string | null;
  sessionDate: string | Date;
}

export interface StudyDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  session?: StudyDialogSession;
  /** Subjects already used, offered as a datalist for faster entry. */
  subjects?: string[];
}

const QUICK_DURATIONS = [15, 25, 45, 60, 90] as const;

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudyDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  session,
  subjects = [],
}: StudyDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(session);

  const defaults: StudyFormValues = {
    subject: session?.subject ?? '',
    topic: session?.topic ?? '',
    durationMinutes: session ? String(session.durationMinutes) : '45',
    notes: session?.notes ?? '',
    sessionDate: session ? new Date(session.sessionDate).toISOString().slice(0, 10) : todayValue(),
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StudyFormValues>({
    resolver: zodResolver(studyFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: StudyFormValues) {
    const payload = {
      subject: values.subject,
      topic: values.topic || undefined,
      durationMinutes: Number(values.durationMinutes),
      notes: values.notes || undefined,
      sessionDate: values.sessionDate,
    };

    try {
      if (isEdit && session) {
        await api.patch(`/api/study/${session.id}`, payload);
        toast({ title: 'Session updated', variant: 'success' });
      } else {
        const result = await api.post<{ xpAwarded: number }>('/api/study', payload);
        toast({
          title: 'Study session logged',
          description: result?.xpAwarded ? `+${result.xpAwarded} XP` : undefined,
          variant: 'success',
        });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the session',
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
          <DialogTitle>{isEdit ? 'Edit study session' : 'Log study session'}</DialogTitle>
          <DialogDescription>
            Sessions roll up into your weekly totals and subject breakdown.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Subject" htmlFor="study-subject" error={errors.subject?.message} required>
            <Input
              id="study-subject"
              list="study-subject-options"
              placeholder="Distributed systems"
              aria-invalid={Boolean(errors.subject)}
              {...register('subject')}
            />
            {subjects.length > 0 ? (
              <datalist id="study-subject-options">
                {subjects.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
            ) : null}
          </Field>

          <Field label="Topic" htmlFor="study-topic" error={errors.topic?.message}>
            <Input id="study-topic" placeholder="Consensus algorithms" {...register('topic')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Duration (minutes)"
              htmlFor="study-duration"
              error={errors.durationMinutes?.message}
              required
            >
              <Input
                id="study-duration"
                inputMode="numeric"
                aria-invalid={Boolean(errors.durationMinutes)}
                {...register('durationMinutes')}
              />
            </Field>

            <Field label="Date" htmlFor="study-date" error={errors.sessionDate?.message} required>
              <Input id="study-date" type="date" {...register('sessionDate')} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_DURATIONS.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setValue('durationMinutes', String(minutes), { shouldValidate: true })
                }
              >
                {minutes}m
              </Button>
            ))}
          </div>

          <Field label="Notes" htmlFor="study-notes" error={errors.notes?.message}>
            <Textarea
              id="study-notes"
              rows={3}
              placeholder="What did you cover? What is still unclear?"
              {...register('notes')}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Log session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

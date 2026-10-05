'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { MOOD_OPTIONS } from '@/components/journal/mood';
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
import { cn } from '@/lib/utils';
import { journalFormSchema, type JournalFormValues } from '@/lib/validations/forms';

export interface JournalDialogEntry {
  id: string;
  title: string | null;
  content: string;
  mood: JournalFormValues['mood'] | null;
  entryDate: string | Date;
}

export interface JournalDialogProps {
  /** Omit when driving the dialog with `open`/`onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  entry?: JournalDialogEntry;
}

export function JournalDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  entry,
}: JournalDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useDialogState(controlledOpen, onOpenChange);
  const isEdit = Boolean(entry);

  const defaults: JournalFormValues = {
    title: entry?.title ?? '',
    content: entry?.content ?? '',
    mood: entry?.mood ?? '',
    entryDate: entry
      ? new Date(entry.entryDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mood = watch('mood');
  const content = watch('content');
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function onSubmit(values: JournalFormValues) {
    const payload = {
      title: values.title || undefined,
      content: values.content,
      mood: values.mood || undefined,
      entryDate: values.entryDate,
    };

    try {
      if (isEdit && entry) {
        await api.patch(`/api/journal/${entry.id}`, payload);
        toast({ title: 'Entry updated', variant: 'success' });
      } else {
        const result = await api.post<{ xpAwarded: number }>('/api/journal', payload);
        toast({
          title: 'Entry saved',
          description: result?.xpAwarded ? `+${result.xpAwarded} XP` : undefined,
          variant: 'success',
        });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
      toast({
        title: 'Could not save the entry',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit entry' : 'New journal entry'}</DialogTitle>
          <DialogDescription>
            Entries are private to your account and count toward your journaling streak.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr,10rem]">
            <Field label="Title" htmlFor="journal-title" error={errors.title?.message}>
              <Input id="journal-title" placeholder="Optional headline" {...register('title')} />
            </Field>
            <Field label="Date" htmlFor="journal-date" error={errors.entryDate?.message} required>
              <Input id="journal-date" type="date" {...register('entryDate')} />
            </Field>
          </div>

          <Field label="Mood" error={errors.mood?.message} hint="Optional — helps filter later.">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mood === option.value}
                  onClick={() =>
                    setValue('mood', mood === option.value ? '' : option.value, {
                      shouldDirty: true,
                    })
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    mood === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Entry"
            htmlFor="journal-content"
            error={errors.content?.message}
            hint={`${wordCount} word${wordCount === 1 ? '' : 's'}`}
            required
          >
            <Textarea
              id="journal-content"
              rows={10}
              placeholder="What happened today? What did you learn?"
              aria-invalid={Boolean(errors.content)}
              {...register('content')}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Save entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

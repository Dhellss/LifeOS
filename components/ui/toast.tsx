'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Minimal toast system.
 *
 * A context provider owns a queue of notifications; `useToast()` pushes onto
 * it. Kept in-house rather than pulled from a library because the surface the
 * app needs is three variants and an auto-dismiss timer.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'info' }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current.slice(-2), { id, title, description, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a <ToastProvider>');
  return context;
}

const VARIANT_STYLES: Record<ToastVariant, { className: string; Icon: typeof Info }> = {
  success: {
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
    Icon: CheckCircle2,
  },
  error: {
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    Icon: AlertCircle,
  },
  info: { className: 'border-border bg-card text-card-foreground', Icon: Info },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    // One live region for the whole stack: `role="status"` implies a polite
    // announcement, and inserted children are read out automatically. The
    // individual toasts are therefore plain elements - giving them live roles
    // too would both double-announce and add a second region that competes
    // with a form's own `role="alert"`.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:w-80"
    >
      {toasts.map((item) => {
        const { className, Icon } = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full animate-slide-in-right items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur',
              className,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs opacity-80">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

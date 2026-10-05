'use client';

import { useCallback, useState } from 'react';

/**
 * Open-state for a dialog that works both ways:
 * uncontrolled when it owns its own trigger, controlled when a parent (the
 * quick-add menu, for example) needs to open it imperatively.
 */
export function useDialogState(
  controlledOpen?: boolean,
  onOpenChange?: (open: boolean) => void,
): readonly [boolean, (open: boolean) => void] {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return [open, setOpen] as const;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await signOut();
          router.replace('/login');
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out of this device
    </Button>
  );
}

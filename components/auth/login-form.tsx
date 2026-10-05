'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth-client';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') ?? '/dashboard';
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const { error } = await signIn.email({ email: values.email, password: values.password });

    if (error) {
      // Credential failures are reported generically so the form cannot be
      // used to probe which email addresses exist.
      setFormError('That email and password combination did not match an account.');
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to open your workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

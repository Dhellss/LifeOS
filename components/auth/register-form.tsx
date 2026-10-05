'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { signUp } from '@/lib/auth-client';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      setFormError(
        error.message ?? 'We could not create that account. The email may already be in use.',
      );
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your workspace</CardTitle>
        <CardDescription>Your data stays private to your account.</CardDescription>
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

          <Field label="Name" htmlFor="name" error={errors.name?.message} required>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

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

          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint="At least 8 characters."
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

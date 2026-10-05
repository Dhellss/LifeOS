import type { Mood } from '@prisma/client';

import { Badge, type BadgeProps } from '@/components/ui/badge';

export interface MoodOption {
  value: Mood;
  label: string;
  emoji: string;
  variant: BadgeProps['variant'];
}

export const MOOD_OPTIONS: readonly MoodOption[] = [
  { value: 'GREAT', label: 'Great', emoji: '🌟', variant: 'success' },
  { value: 'GOOD', label: 'Good', emoji: '🙂', variant: 'info' },
  { value: 'NEUTRAL', label: 'Neutral', emoji: '😐', variant: 'secondary' },
  { value: 'LOW', label: 'Low', emoji: '🌧️', variant: 'warning' },
  { value: 'BAD', label: 'Bad', emoji: '💥', variant: 'danger' },
] as const;

const MOOD_MAP = new Map(MOOD_OPTIONS.map((option) => [option.value, option]));

export function moodOption(mood: Mood | null | undefined): MoodOption | undefined {
  return mood ? MOOD_MAP.get(mood) : undefined;
}

export function MoodBadge({ mood }: { mood: Mood | null }) {
  const option = moodOption(mood);
  if (!option) return null;
  return (
    <Badge variant={option.variant}>
      <span aria-hidden>{option.emoji}</span>
      {option.label}
    </Badge>
  );
}

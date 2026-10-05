import type { Mood } from '@prisma/client';

import { created, failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createJournalEntry, listJournalEntries } from '@/lib/services/journal';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const mood = params.get('mood');
    return ok(
      await listJournalEntries(user.id, {
        search: params.get('search') ?? undefined,
        mood: (mood as Mood | null) ?? undefined,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return created(await createJournalEntry(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

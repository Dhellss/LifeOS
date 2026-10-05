import type { CalendarEvent } from '@prisma/client';

import { created, failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createEvent, listEvents } from '@/lib/services/calendar';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const type = params.get('type');
    return ok(
      await listEvents(user.id, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        type: (type as CalendarEvent['type'] | null) ?? undefined,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return created(await createEvent(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

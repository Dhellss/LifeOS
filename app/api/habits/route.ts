import { created, failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createHabit, listHabits } from '@/lib/services/habits';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
    return ok(await listHabits(user.id, { includeInactive }));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return created(await createHabit(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

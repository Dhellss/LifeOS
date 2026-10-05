import { failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { checkInHabit } from '@/lib/services/habits';

/** Upsert a habit log for one day. `count: 0` removes the check-in. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await checkInHabit(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

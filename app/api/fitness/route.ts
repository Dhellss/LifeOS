import { created, failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createWorkout, listWorkouts } from '@/lib/services/fitness';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    return ok(
      await listWorkouts(user.id, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return created(await createWorkout(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

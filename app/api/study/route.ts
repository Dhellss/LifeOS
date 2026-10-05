import { created, failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createStudySession, listStudySessions } from '@/lib/services/study';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    return ok(
      await listStudySessions(user.id, {
        subject: params.get('subject') ?? undefined,
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
    return created(await createStudySession(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

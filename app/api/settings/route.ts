import { failure, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { getPreferences, updatePreferences } from '@/lib/services/preferences';

export async function GET() {
  try {
    const user = await requireApiUser();
    return ok(await getPreferences(user.id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await updatePreferences(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

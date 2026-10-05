import { created, failure, ok, readJson, searchParamsToObject } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createProject, listProjects } from '@/lib/services/projects';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    return ok(await listProjects(user.id, searchParamsToObject(request.url)));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    return created(await createProject(user.id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

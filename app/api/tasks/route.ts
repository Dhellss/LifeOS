import { created, failure, ok, readJson, searchParamsToObject } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { createTask, listTasks } from '@/lib/services/tasks';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const tasks = await listTasks(user.id, searchParamsToObject(request.url));
    return ok(tasks);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const task = await createTask(user.id, await readJson(request));
    return created(task);
  } catch (error) {
    return failure(error);
  }
}

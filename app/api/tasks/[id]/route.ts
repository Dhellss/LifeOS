import { failure, noContent, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { deleteTask, getTask, updateTask } from '@/lib/services/tasks';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return ok(await getTask(user.id, id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return ok(await updateTask(user.id, id, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await deleteTask(user.id, id);
    return noContent();
  } catch (error) {
    return failure(error);
  }
}

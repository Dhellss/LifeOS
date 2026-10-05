import { failure, noContent, ok, readJson } from '@/lib/api-response';
import { requireApiUser } from '@/lib/session';
import { completeProject, deleteProject, getProject, updateProject } from '@/lib/services/projects';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return ok(await getProject(user.id, id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = (await readJson(request)) as Record<string, unknown>;

    // `{ action: "complete" }` also closes the project's open tasks, which a
    // plain status PATCH deliberately does not do.
    if (body.action === 'complete') {
      return ok(await completeProject(user.id, id));
    }
    return ok(await updateProject(user.id, id, body));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await deleteProject(user.id, id);
    return noContent();
  } catch (error) {
    return failure(error);
  }
}

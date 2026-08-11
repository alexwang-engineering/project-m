import { notFound } from 'next/navigation';

import SubmissionsView from '@/components/assignments/SubmissionsView';
import { createServerClient } from '@/lib/supabase/server';
import { createBlockFileDownloads } from '@/lib/files/service';
import {
  getAssignmentDetail,
  type AssignmentDetail,
} from '@/lib/content/assignments';

interface AssignmentDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Fails closed to not-found when Supabase isn't configured, same as the dashboard and assignments list. */
async function loadAssignmentDetail(
  id: string,
): Promise<AssignmentDetail | null> {
  try {
    const supabase = await createServerClient();
    return await getAssignmentDetail(supabase, id);
  } catch {
    return null;
  }
}

export default async function AssignmentDetailPage({
  params,
}: AssignmentDetailPageProps) {
  const { id } = await params;
  const detail = await loadAssignmentDetail(id);
  if (!detail) notFound();
  const supabase = await createServerClient();
  const instructionFiles = detail.instructions
    ? await createBlockFileDownloads(supabase, detail.instructions.content)
    : {};

  return (
    <SubmissionsView assignment={detail} instructionFiles={instructionFiles} />
  );
}

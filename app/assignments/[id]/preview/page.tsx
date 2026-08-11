import { notFound } from 'next/navigation';

import SubmissionsView from '@/components/assignments/SubmissionsView';
import { getAssignmentStudentPreview } from '@/lib/content/assignments';
import { createBlockFileDownloads } from '@/lib/files/service';
import { createServerClient } from '@/lib/supabase/server';

export default async function AssignmentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const assignment = await getAssignmentStudentPreview(supabase, id).catch(
    () => null,
  );
  if (!assignment) notFound();
  const instructionFiles = assignment.instructions
    ? await createBlockFileDownloads(supabase, assignment.instructions.content)
    : {};
  return (
    <SubmissionsView
      assignment={assignment}
      instructionFiles={instructionFiles}
    />
  );
}

import AssignmentsView from '@/components/assignments/AssignmentsView';
import { createServerClient } from '@/lib/supabase/server';
import { listAssignments } from '@/lib/content/assignments';
import type { AssignmentSummary } from '@/lib/content/assignments';

/** Fails closed to an empty list when Supabase isn't configured, same as the dashboard. */
async function loadAssignments(): Promise<readonly AssignmentSummary[]> {
  try {
    const supabase = await createServerClient();
    return await listAssignments(supabase);
  } catch {
    return [];
  }
}

export default async function AssignmentsPage() {
  const assignments = await loadAssignments();
  return <AssignmentsView assignments={assignments} />;
}

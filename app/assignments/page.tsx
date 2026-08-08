import AssignmentsView from '@/components/assignments/AssignmentsView';
import { createServerClient } from '@/lib/supabase/server';
import { listAssignments } from '@/lib/content/assignments';
import { getCurrentUserSummary } from '@/lib/content/dashboard';
import type { AssignmentSummary } from '@/lib/content/assignments';

/** Fails closed to an empty list when Supabase isn't configured, same as the dashboard. */
async function loadAssignments(): Promise<{
  assignments: readonly AssignmentSummary[];
  canCreate: boolean;
}> {
  try {
    const supabase = await createServerClient();
    const [assignments, user] = await Promise.all([
      listAssignments(supabase),
      getCurrentUserSummary(supabase),
    ]);
    return {
      assignments,
      canCreate: user?.role === 'teacher' || user?.role === 'admin',
    };
  } catch {
    return { assignments: [], canCreate: false };
  }
}

export default async function AssignmentsPage() {
  const { assignments, canCreate } = await loadAssignments();
  return <AssignmentsView assignments={assignments} canCreate={canCreate} />;
}

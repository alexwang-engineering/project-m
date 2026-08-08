import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { listWritableTags } from '@/lib/content/pages-editor';

type Client = SupabaseClient<Database>;

export interface StudentGradeRow {
  readonly kind: 'assignment' | 'quiz';
  readonly id: string;
  readonly title: string;
  readonly scoreLabel: string;
  readonly recordedAt: string;
}

export interface TeacherRollupRow {
  readonly kind: 'assignment' | 'quiz';
  readonly id: string;
  readonly title: string;
  readonly count: number;
  readonly averageLabel: string | null;
}

export interface GradebookData {
  readonly manages: boolean;
  readonly studentRows: readonly StudentGradeRow[];
  readonly teacherRows: readonly TeacherRollupRow[];
}

/** A student's own grades: graded assignment submissions + auto-graded quiz attempts. */
async function loadStudentRows(
  client: Client,
  userId: string,
): Promise<readonly StudentGradeRow[]> {
  const [
    { data: submissions, error: submissionsError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    client
      .from('assignment_submissions')
      .select(
        'id, assignments(id, title), assignment_grades!inner(grade, graded_at)',
      )
      .eq('student_id', userId)
      .not('assignment_grades.released_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(200),
    client
      .from('quiz_attempts')
      .select('id, score, max_score, submitted_at, quizzes(id, title)')
      .eq('student_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(200),
  ]);
  if (submissionsError) throw submissionsError;
  if (attemptsError) throw attemptsError;

  const assignmentRows: StudentGradeRow[] = (submissions ?? [])
    .filter(
      (
        s,
      ): s is typeof s & {
        assignments: NonNullable<typeof s.assignments>;
        assignment_grades: NonNullable<typeof s.assignment_grades>;
      } => s.assignments !== null && s.assignment_grades !== null,
    )
    .map((s) => ({
      kind: 'assignment' as const,
      id: s.assignments.id,
      title: s.assignments.title,
      scoreLabel: `${s.assignment_grades.grade}/100`,
      recordedAt: s.assignment_grades.graded_at,
    }));

  const quizRows: StudentGradeRow[] = (attempts ?? [])
    .filter(
      (a): a is typeof a & { quizzes: NonNullable<typeof a.quizzes> } =>
        a.quizzes !== null,
    )
    .map((a) => ({
      kind: 'quiz' as const,
      id: a.quizzes.id,
      title: a.quizzes.title,
      scoreLabel: `${a.score}/${a.max_score}`,
      recordedAt: a.submitted_at,
    }));

  return [...assignmentRows, ...quizRows].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  );
}

/** Bounded roll-up stats computed in Postgres for recent assessments the caller manages. */
async function loadTeacherRows(
  client: Client,
): Promise<readonly TeacherRollupRow[]> {
  const { data, error } = await client.rpc('teacher_gradebook_rollups', {
    row_limit: 200,
  });
  if (error) throw error;
  return (data ?? [])
    .map((row): TeacherRollupRow => ({
      kind: row.item_kind === 'quiz' ? 'quiz' : 'assignment',
      id: row.item_id,
      title: row.item_title,
      count: row.submission_count,
      averageLabel:
        row.average_percent === null
          ? null
          : `${Math.round(row.average_percent)}%`,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Loads the caller's gradebook: their own grades, plus roll-ups for anything they manage. */
export async function getGradebook(client: Client): Promise<GradebookData> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { manages: false, studentRows: [], teacherRows: [] };

  const writableTags = await listWritableTags(client);
  const managedTagIds = writableTags.map((tag) => tag.id);

  const [studentRows, teacherRows] = await Promise.all([
    loadStudentRows(client, user.id),
    loadTeacherRows(client),
  ]);

  return {
    manages: teacherRows.length > 0 || managedTagIds.length > 0,
    studentRows,
    teacherRows,
  };
}

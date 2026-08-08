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
      .select('id, grade, graded_at, assignments(id, title)')
      .eq('student_id', userId)
      .not('grade', 'is', null),
    client
      .from('quiz_attempts')
      .select('id, score, max_score, submitted_at, quizzes(id, title)')
      .eq('student_id', userId),
  ]);
  if (submissionsError) throw submissionsError;
  if (attemptsError) throw attemptsError;

  const assignmentRows: StudentGradeRow[] = (submissions ?? [])
    .filter(
      (
        s,
      ): s is typeof s & {
        assignments: NonNullable<typeof s.assignments>;
        grade: number;
        graded_at: string;
      } => s.assignments !== null && s.grade !== null && s.graded_at !== null,
    )
    .map((s) => ({
      kind: 'assignment' as const,
      id: s.assignments.id,
      title: s.assignments.title,
      scoreLabel: `${s.grade}/100`,
      recordedAt: s.graded_at,
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

/** Roll-up stats (count + average) for every assignment/quiz the caller manages, via tag overlap. */
async function loadTeacherRows(
  client: Client,
  managedTagIds: readonly string[],
): Promise<readonly TeacherRollupRow[]> {
  if (managedTagIds.length === 0) return [];

  const [
    { data: assignmentTags, error: assignmentTagsError },
    { data: quizTags, error: quizTagsError },
  ] = await Promise.all([
    client
      .from('assignment_tags')
      .select('assignments(id, title)')
      .in('tag_id', managedTagIds),
    client
      .from('quiz_tags')
      .select('quizzes(id, title)')
      .in('tag_id', managedTagIds),
  ]);
  if (assignmentTagsError) throw assignmentTagsError;
  if (quizTagsError) throw quizTagsError;

  const assignmentById = new Map<string, string>();
  for (const row of assignmentTags ?? []) {
    if (row.assignments)
      assignmentById.set(row.assignments.id, row.assignments.title);
  }
  const quizById = new Map<string, string>();
  for (const row of quizTags ?? []) {
    if (row.quizzes) quizById.set(row.quizzes.id, row.quizzes.title);
  }

  const [
    { data: allSubmissions, error: submissionsError },
    { data: allAttempts, error: attemptsError },
  ] = await Promise.all([
    assignmentById.size > 0
      ? client
          .from('assignment_submissions')
          .select('assignment_id, grade')
          .in('assignment_id', Array.from(assignmentById.keys()))
      : Promise.resolve({ data: [], error: null }),
    quizById.size > 0
      ? client
          .from('quiz_attempts')
          .select('quiz_id, score, max_score')
          .in('quiz_id', Array.from(quizById.keys()))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (submissionsError) throw submissionsError;
  if (attemptsError) throw attemptsError;

  const assignmentRows: TeacherRollupRow[] = Array.from(
    assignmentById,
    ([id, title]) => {
      const rows = (allSubmissions ?? []).filter((s) => s.assignment_id === id);
      const graded = rows.filter((s) => s.grade !== null);
      const average =
        graded.length > 0
          ? graded.reduce((sum, s) => sum + (s.grade as number), 0) /
            graded.length
          : null;
      return {
        kind: 'assignment' as const,
        id,
        title,
        count: rows.length,
        averageLabel: average === null ? null : `${Math.round(average)}%`,
      };
    },
  );

  const quizRows: TeacherRollupRow[] = Array.from(quizById, ([id, title]) => {
    const rows = (allAttempts ?? []).filter((a) => a.quiz_id === id);
    const average =
      rows.length > 0
        ? rows.reduce(
            (sum, a) => sum + (a.max_score > 0 ? a.score / a.max_score : 0),
            0,
          ) / rows.length
        : null;
    return {
      kind: 'quiz' as const,
      id,
      title,
      count: rows.length,
      averageLabel: average === null ? null : `${Math.round(average * 100)}%`,
    };
  });

  return [...assignmentRows, ...quizRows].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
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
    loadTeacherRows(client, managedTagIds),
  ]);

  return {
    manages: teacherRows.length > 0 || managedTagIds.length > 0,
    studentRows,
    teacherRows,
  };
}

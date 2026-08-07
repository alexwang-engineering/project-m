import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { createPage } from '@/lib/content/mutations';
import { createAssignment } from '@/lib/content/assignments';
import { createQuiz } from '@/lib/content/quizzes';
import type { MigrationManifest, MigrationReportEntry } from '@/lib/content/migration-types';
import { sha256HexOfText } from '@/lib/files/client-hash';

type Client = SupabaseClient<Database>;

export type { MigrationManifest, MigrationReportEntry } from '@/lib/content/migration-types';

/** SHA-256 of the fields that determine whether re-importing this item would change anything. */
function checksumOf(payload: unknown): Promise<string> {
  return sha256HexOfText(JSON.stringify(payload));
}

async function resolveTagId(client: Client, tagName: string): Promise<string | null> {
  const { data } = await client.from('tags').select('id').eq('tag_name', tagName.toUpperCase()).eq('is_active', true).maybeSingle();
  return data?.id ?? null;
}

async function checkExisting(
  client: Client,
  externalId: string,
  checksum: string,
): Promise<{ readonly proceed: true } | { readonly proceed: false; readonly status: 'unchanged' | 'conflict' }> {
  const { data } = await client.rpc('get_migration_import', { ext_source: 'moodle', ext_id: externalId });
  if (!data || !data.external_id) return { proceed: true };
  return { proceed: false, status: data.content_checksum === checksum ? 'unchanged' : 'conflict' };
}

async function record(
  client: Client,
  externalId: string,
  runId: string,
  internalType: 'page' | 'assignment' | 'quiz',
  internalId: string,
  checksum: string,
  originalAuthor: string | undefined,
): Promise<void> {
  await client.rpc('record_migration_import', {
    ext_source: 'moodle',
    ext_id: externalId,
    migration_run_id: runId,
    content_type: internalType,
    content_id: internalId,
    checksum,
    author_note: originalAuthor ?? null,
    correlation_id: crypto.randomUUID(),
  });
}

/**
 * Imports a staged migration manifest, item by item. Every actual content
 * write reuses the already-tested createPage/createAssignment/createQuiz
 * functions - this only adds resumability (checksum-tracked, skips
 * unchanged items) and reports conflicts/quarantines rather than silently
 * overwriting or crashing the batch (ADR-019).
 */
export async function importMigrationManifest(
  client: Client,
  manifest: MigrationManifest,
  runId: string,
  dryRun: boolean,
): Promise<readonly MigrationReportEntry[]> {
  const report: MigrationReportEntry[] = [];

  for (const resource of manifest.resources) {
    const tagId = await resolveTagId(client, resource.tagName);
    if (!tagId) {
      report.push({ externalId: resource.externalId, kind: 'page', title: resource.title, status: 'quarantined', message: `Tag "${resource.tagName}" does not exist.` });
      continue;
    }
    const checksum = await checksumOf({ title: resource.title, html: resource.html });
    const existing = await checkExisting(client, resource.externalId, checksum);
    if (!existing.proceed) {
      report.push({ externalId: resource.externalId, kind: 'page', title: resource.title, status: existing.status });
      continue;
    }
    if (dryRun) {
      report.push({ externalId: resource.externalId, kind: 'page', title: resource.title, status: 'would_import' });
      continue;
    }
    const slug = `moodle-${resource.externalId}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const created = await createPage(client, {
      title: resource.title,
      slug,
      parentId: null,
      content: { schemaVersion: 1, blocks: [{ id: crypto.randomUUID(), type: 'paragraph', html: resource.html }] },
      tagIds: [tagId],
    });
    if (!created.ok) {
      report.push({ externalId: resource.externalId, kind: 'page', title: resource.title, status: 'failed', message: created.message });
      continue;
    }
    await record(client, resource.externalId, runId, 'page', created.page.id, checksum, resource.originalAuthor);
    report.push({ externalId: resource.externalId, kind: 'page', title: resource.title, status: 'imported' });
  }

  for (const assignment of manifest.assignments) {
    const tagId = await resolveTagId(client, assignment.tagName);
    if (!tagId) {
      report.push({ externalId: assignment.externalId, kind: 'assignment', title: assignment.title, status: 'quarantined', message: `Tag "${assignment.tagName}" does not exist.` });
      continue;
    }
    const checksum = await checksumOf({ title: assignment.title, dueAt: assignment.dueAt, allowResubmission: assignment.allowResubmission });
    const existing = await checkExisting(client, assignment.externalId, checksum);
    if (!existing.proceed) {
      report.push({ externalId: assignment.externalId, kind: 'assignment', title: assignment.title, status: existing.status });
      continue;
    }
    if (dryRun) {
      report.push({ externalId: assignment.externalId, kind: 'assignment', title: assignment.title, status: 'would_import' });
      continue;
    }
    const created = await createAssignment(client, {
      title: assignment.title,
      dueAt: assignment.dueAt,
      allowResubmission: assignment.allowResubmission,
      tagIds: [tagId],
    });
    if (!created.ok) {
      report.push({ externalId: assignment.externalId, kind: 'assignment', title: assignment.title, status: 'failed', message: created.message });
      continue;
    }
    await record(client, assignment.externalId, runId, 'assignment', created.assignment.id, checksum, assignment.originalAuthor);
    report.push({ externalId: assignment.externalId, kind: 'assignment', title: assignment.title, status: 'imported' });
  }

  for (const quiz of manifest.quizzes) {
    const tagId = await resolveTagId(client, quiz.tagName);
    if (!tagId) {
      report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: 'quarantined', message: `Tag "${quiz.tagName}" does not exist.` });
      continue;
    }
    const unsupported = quiz.questions.some((q) => q.choices.length < 2 || q.correctChoiceIndex < 0 || q.correctChoiceIndex >= q.choices.length);
    if (quiz.questions.length === 0 || unsupported) {
      report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: 'quarantined', message: 'Only multiple-choice questions with at least 2 choices are supported.' });
      continue;
    }
    const checksum = await checksumOf({ title: quiz.title, dueAt: quiz.dueAt, questions: quiz.questions });
    const existing = await checkExisting(client, quiz.externalId, checksum);
    if (!existing.proceed) {
      report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: existing.status });
      continue;
    }
    if (dryRun) {
      report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: 'would_import' });
      continue;
    }
    const created = await createQuiz(client, {
      title: quiz.title,
      dueAt: quiz.dueAt,
      tagIds: [tagId],
      questions: quiz.questions.map((q) => {
        const choices = q.choices.map((label) => ({ id: crypto.randomUUID(), label }));
        return { prompt: q.prompt, choices, correctChoiceId: choices[q.correctChoiceIndex]!.id };
      }),
    });
    if (!created.ok) {
      report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: 'failed', message: created.message });
      continue;
    }
    await record(client, quiz.externalId, runId, 'quiz', created.quiz.id, checksum, quiz.originalAuthor);
    report.push({ externalId: quiz.externalId, kind: 'quiz', title: quiz.title, status: 'imported' });
  }

  return report;
}

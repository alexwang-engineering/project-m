import type { MigrationAssignment, MigrationManifest, MigrationQuiz, MigrationResource } from '@/lib/content/migration-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseResource(raw: unknown, index: number, errors: string[]): MigrationResource | null {
  if (!isRecord(raw)) {
    errors.push(`resources[${index}] must be an object.`);
    return null;
  }
  if (typeof raw.externalId !== 'string' || !raw.externalId) errors.push(`resources[${index}] needs a non-empty externalId.`);
  if (typeof raw.tagName !== 'string' || !raw.tagName) errors.push(`resources[${index}] needs a non-empty tagName.`);
  if (typeof raw.title !== 'string' || !raw.title) errors.push(`resources[${index}] needs a non-empty title.`);
  if (typeof raw.html !== 'string') errors.push(`resources[${index}] needs an html string (can be empty).`);
  if (typeof raw.externalId !== 'string' || typeof raw.tagName !== 'string' || typeof raw.title !== 'string' || typeof raw.html !== 'string') return null;
  return {
    externalId: raw.externalId,
    tagName: raw.tagName,
    title: raw.title,
    html: raw.html,
    originalAuthor: typeof raw.originalAuthor === 'string' ? raw.originalAuthor : undefined,
  };
}

function parseAssignment(raw: unknown, index: number, errors: string[]): MigrationAssignment | null {
  if (!isRecord(raw)) {
    errors.push(`assignments[${index}] must be an object.`);
    return null;
  }
  if (typeof raw.externalId !== 'string' || !raw.externalId) errors.push(`assignments[${index}] needs a non-empty externalId.`);
  if (typeof raw.tagName !== 'string' || !raw.tagName) errors.push(`assignments[${index}] needs a non-empty tagName.`);
  if (typeof raw.title !== 'string' || !raw.title) errors.push(`assignments[${index}] needs a non-empty title.`);
  if (raw.dueAt !== null && raw.dueAt !== undefined && typeof raw.dueAt !== 'string') errors.push(`assignments[${index}].dueAt must be a string or null.`);
  if (typeof raw.allowResubmission !== 'boolean') errors.push(`assignments[${index}] needs allowResubmission as a boolean.`);
  if (typeof raw.externalId !== 'string' || typeof raw.tagName !== 'string' || typeof raw.title !== 'string' || typeof raw.allowResubmission !== 'boolean') return null;
  return {
    externalId: raw.externalId,
    tagName: raw.tagName,
    title: raw.title,
    dueAt: typeof raw.dueAt === 'string' ? raw.dueAt : null,
    allowResubmission: raw.allowResubmission,
    originalAuthor: typeof raw.originalAuthor === 'string' ? raw.originalAuthor : undefined,
  };
}

function parseQuiz(raw: unknown, index: number, errors: string[]): MigrationQuiz | null {
  if (!isRecord(raw)) {
    errors.push(`quizzes[${index}] must be an object.`);
    return null;
  }
  if (typeof raw.externalId !== 'string' || !raw.externalId) errors.push(`quizzes[${index}] needs a non-empty externalId.`);
  if (typeof raw.tagName !== 'string' || !raw.tagName) errors.push(`quizzes[${index}] needs a non-empty tagName.`);
  if (typeof raw.title !== 'string' || !raw.title) errors.push(`quizzes[${index}] needs a non-empty title.`);
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    errors.push(`quizzes[${index}] needs at least one question.`);
    return null;
  }
  const questions = raw.questions.map((q, qi) => {
    if (!isRecord(q) || typeof q.prompt !== 'string' || !Array.isArray(q.choices) || typeof q.correctChoiceIndex !== 'number') {
      errors.push(`quizzes[${index}].questions[${qi}] must have prompt, choices[], and correctChoiceIndex.`);
      return null;
    }
    const choices = q.choices.filter((c): c is string => typeof c === 'string');
    if (choices.length < 2) {
      errors.push(`quizzes[${index}].questions[${qi}] needs at least 2 choices.`);
      return null;
    }
    return { prompt: q.prompt, choices, correctChoiceIndex: q.correctChoiceIndex };
  });
  if (questions.some((q) => q === null) || typeof raw.externalId !== 'string' || typeof raw.tagName !== 'string' || typeof raw.title !== 'string') return null;
  return {
    externalId: raw.externalId,
    tagName: raw.tagName,
    title: raw.title,
    dueAt: typeof raw.dueAt === 'string' ? raw.dueAt : null,
    questions: questions as { prompt: string; choices: string[]; correctChoiceIndex: number }[],
    originalAuthor: typeof raw.originalAuthor === 'string' ? raw.originalAuthor : undefined,
  };
}

/** Parses and structurally validates a migration manifest JSON file. Pure and client-safe. */
export function parseMigrationManifest(text: string): { readonly manifest: MigrationManifest | null; readonly errors: readonly string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { manifest: null, errors: ['The file is not valid JSON.'] };
  }
  if (!isRecord(raw)) return { manifest: null, errors: ['The manifest must be a JSON object.'] };

  const errors: string[] = [];
  const resources = (Array.isArray(raw.resources) ? raw.resources : []).map((r, i) => parseResource(r, i, errors)).filter((r): r is MigrationResource => r !== null);
  const assignments = (Array.isArray(raw.assignments) ? raw.assignments : []).map((a, i) => parseAssignment(a, i, errors)).filter((a): a is MigrationAssignment => a !== null);
  const quizzes = (Array.isArray(raw.quizzes) ? raw.quizzes : []).map((q, i) => parseQuiz(q, i, errors)).filter((q): q is MigrationQuiz => q !== null);

  if (resources.length === 0 && assignments.length === 0 && quizzes.length === 0 && errors.length === 0) {
    errors.push('The manifest has no resources, assignments, or quizzes to import.');
  }
  return { manifest: { resources, assignments, quizzes }, errors };
}

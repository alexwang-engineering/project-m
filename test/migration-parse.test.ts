import { describe, expect, it } from 'vitest';

import {
  MAX_MIGRATION_ITEMS,
  parseMigrationManifest,
} from '@/lib/content/migration-parse';

describe('parseMigrationManifest', () => {
  it('rejects invalid JSON', () => {
    const { manifest, errors } = parseMigrationManifest('{not json');
    expect(manifest).toBeNull();
    expect(errors).toContain('The file is not valid JSON.');
  });

  it('rejects a non-object top level', () => {
    const { manifest, errors } = parseMigrationManifest('[1,2,3]');
    expect(manifest).toBeNull();
    expect(errors).toContain('The manifest must be a JSON object.');
  });

  it('parses a well-formed manifest with all three item types', () => {
    const { manifest, errors } = parseMigrationManifest(
      JSON.stringify({
        resources: [
          {
            externalId: 'r1',
            tagName: 'Y10MA1',
            title: 'Notes',
            html: '<p>hi</p>',
          },
        ],
        assignments: [
          {
            externalId: 'a1',
            tagName: 'Y10MA1',
            title: 'HW1',
            dueAt: null,
            allowResubmission: true,
          },
        ],
        quizzes: [
          {
            externalId: 'q1',
            tagName: 'Y10MA1',
            title: 'Quiz 1',
            dueAt: null,
            questions: [
              { prompt: '2+2?', choices: ['3', '4'], correctChoiceIndex: 1 },
            ],
          },
        ],
      }),
    );
    expect(errors).toEqual([]);
    expect(manifest?.resources).toHaveLength(1);
    expect(manifest?.assignments).toHaveLength(1);
    expect(manifest?.quizzes).toHaveLength(1);
    expect(manifest?.quizzes[0]?.questions[0]?.correctChoiceIndex).toBe(1);
  });

  it('reports a missing-field resource without crashing and drops it from the parsed manifest', () => {
    const { manifest, errors } = parseMigrationManifest(
      JSON.stringify({ resources: [{ externalId: 'r1' }] }),
    );
    expect(manifest?.resources).toHaveLength(0);
    expect(errors.some((e) => e.includes('resources[0]'))).toBe(true);
  });

  it('quarantines a quiz question with fewer than 2 choices at parse time', () => {
    const { manifest, errors } = parseMigrationManifest(
      JSON.stringify({
        quizzes: [
          {
            externalId: 'q1',
            tagName: 'Y10MA1',
            title: 'Bad quiz',
            questions: [
              { prompt: 'x?', choices: ['only one'], correctChoiceIndex: 0 },
            ],
          },
        ],
      }),
    );
    expect(manifest?.quizzes).toHaveLength(0);
    expect(errors.some((e) => e.includes('needs at least 2 choices'))).toBe(
      true,
    );
  });

  it('reports an empty manifest as an error rather than silently succeeding', () => {
    const { errors } = parseMigrationManifest(JSON.stringify({}));
    expect(errors).toContain(
      'The manifest has no resources, assignments, or quizzes to import.',
    );
  });

  it('rejects oversized item lists before parsing every entry', () => {
    const { manifest, errors } = parseMigrationManifest(
      JSON.stringify({ resources: Array(MAX_MIGRATION_ITEMS + 1).fill(null) }),
    );
    expect(manifest).toBeNull();
    expect(errors[0]).toContain(`${MAX_MIGRATION_ITEMS} items`);
  });

  it('rejects a quiz answer index outside its choices', () => {
    const { errors } = parseMigrationManifest(
      JSON.stringify({
        quizzes: [
          {
            externalId: 'q1',
            tagName: 'Y10MA1',
            title: 'Bad answer',
            questions: [
              { prompt: 'x?', choices: ['a', 'b'], correctChoiceIndex: 2 },
            ],
          },
        ],
      }),
    );
    expect(errors.some((error) => error.includes('out of range'))).toBe(true);
  });
});

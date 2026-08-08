export interface MigrationResource {
  readonly externalId: string;
  readonly tagName: string;
  readonly title: string;
  readonly html: string;
  readonly originalAuthor?: string;
}

export interface MigrationAssignment {
  readonly externalId: string;
  readonly tagName: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly allowResubmission: boolean;
  readonly originalAuthor?: string;
}

export interface MigrationQuizQuestion {
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly correctChoiceIndex: number;
}

export interface MigrationQuiz {
  readonly externalId: string;
  readonly tagName: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly questions: readonly MigrationQuizQuestion[];
  readonly originalAuthor?: string;
}

export interface MigrationManifest {
  readonly resources: readonly MigrationResource[];
  readonly assignments: readonly MigrationAssignment[];
  readonly quizzes: readonly MigrationQuiz[];
}

export interface MigrationReportEntry {
  readonly externalId: string;
  readonly kind: 'page' | 'assignment' | 'quiz';
  readonly title: string;
  readonly status:
    | 'imported'
    | 'unchanged'
    | 'conflict'
    | 'quarantined'
    | 'failed'
    | 'would_import';
  readonly message?: string;
}

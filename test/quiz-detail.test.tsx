import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import QuizDetailView from '@/components/quizzes/QuizDetailView';

const submitAttempt = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/quizzes', () => ({
  submitQuizAttemptAction: submitAttempt,
}));

describe('quiz answer controls', () => {
  it('submits radio and checkbox answers in their server contract shapes', async () => {
    submitAttempt.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <QuizDetailView
        quiz={{
          id: 'quiz-1',
          title: 'Mixed quiz',
          dueAt: null,
          canManage: false,
          myAttempt: null,
          attempts: [],
          attemptLimit: 2,
          gradebookPolicy: 'highest',
          attemptCount: 0,
          questions: [
            {
              id: 'one',
              prompt: 'Choose one',
              kind: 'multiple_choice',
              weight: 2,
              choices: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
            },
            {
              id: 'many',
              prompt: 'Choose many',
              kind: 'multiple_answer',
              weight: 3,
              choices: [
                { id: 'a', label: 'Alpha' },
                { id: 'b', label: 'Beta' },
                { id: 'c', label: 'Gamma' },
              ],
            },
          ],
        }}
      />,
    );

    const submit = screen.getByRole('button', { name: 'Submit answers' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'B' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Gamma' }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(submitAttempt).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      answers: { one: 'b', many: ['a', 'c'] },
    });
    expect(await screen.findByText('Attempt submitted')).toBeInTheDocument();
  });
});

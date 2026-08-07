# ADR-014: Question Bank Scope

Status: Accepted
Date: 2026-08-07

## Context

Package P's quiz migration explicitly deferred this: *"No timers, no question banks, no partial credit, no manual review queue - those stay separate, additive work if ever needed."* A first-principles audit against PM-02's Teacher journey #4 ("Create a question bank and quiz with deterministic grading rules") confirmed the gap is real: `quiz_questions` has a direct `quiz_id` foreign key only, no shared table, no reuse path. This ADR scopes the "separate, additive work."

Asked the product owner directly whether bank items should be shared the same tag-scoped way every other content type in this project already works, or kept private per teacher. Confirmed: **tag-scoped and shared**, reusing the exact same any-owned-tag-read / all-owned-tag-write pattern already proven for pages, assignments, quizzes, calendar events, and announcements — not a new sharing model.

## Decision

### Data model

`question_bank_items` is a new, standalone table — **not** a generalization of `quiz_questions`, and quizzes do not reference it live. A bank item has `prompt`, `choices` (same 2-8-option jsonb shape `quiz_questions` already validates), and `correct_choice_id` stored directly on the row (no separate answer-key table, unlike quizzes): the security property `quiz_answer_keys` protects — a student must never read a correct answer before attempting — does not apply here, because **no student read path to the bank exists at all**. Read and manage collapse to one authorization tier (`can_access_bank_item`: creator, `institution_admin`, or teacher/manager on any of the item's tags), unlike quizzes' broader member-can-read/teacher-can-manage split.

`question_bank_item_tags` mirrors `quiz_tags`/`assignment_tags` exactly. Creating a bank item requires teacher/manager on every selected tag (`assert_can_assign_tags`, reused directly).

### Reuse is copy-on-import, not a live reference

When a teacher builds a quiz from bank items, the chosen items' `prompt`/`choices`/`correct_choice_id` are **copied** into fresh `quiz_questions`/`quiz_answer_keys` rows at quiz-creation time — the quiz has no ongoing link to the bank afterward. This matches the immutable-snapshot precedent already established for page revisions: a quiz that students have already attempted must never retroactively change because someone edited or archived the source bank item later. The only trace left behind is optional provenance (`quiz_questions.sourced_from_bank_item_id`, nullable, for "where did this come from" — not a live dependency).

### `create_quiz` gains an optional capability, not a new RPC

`create_quiz`'s existing `quiz_questions` jsonb parameter already carries one shape (`prompt`/`choices`/`correct_choice_id` per entry). This adds a second, optional shape for the same array position: `{ bank_item_id }`. When present, the RPC calls `can_access_bank_item(bank_item_id)` first — the same defensive read-before-use check `create_assignment` already applies to `instructions_page` — then copies that item's content in place of requiring inline prompt/choices. Every existing call to `create_quiz` (all inline questions, no `bank_item_id` anywhere) continues to behave identically; this is purely additive to the parameter shape, not a rewrite, so the existing quiz pgTAP coverage should need no changes.

### UI

- A bank browsing/creation surface (new bank item: prompt + choices + correct answer + audience tags, same shape as `CreateTagForm`/`CreateEventForm`) — either its own `/question-bank` page or a panel inside the quiz editor; left to implementation, not load-bearing for this ADR.
- `QuizEditor`'s per-question flow gains a second entry path alongside "write a new question": "add from bank," filtered to tags the teacher can already reuse from. A quiz may freely mix bank-sourced and freshly-written questions — no reason to force one or the other.
- No edit UI for bank items in v1 (create + archive only), matching the create-and-retract precedent already set for calendar events and announcements — a wrong bank item is archived and re-created, not patched in place.

## Consequences

This is the first content type in the project where the "read" and "manage" authorization tiers are identical (no student-facing read path at all), which simplifies its RLS to a single policy rather than the read/manage split every other content type needs — worth remembering as a pattern for any future teacher-only-visibility content type. Tests must cover: bank item creation authorization (all-owned-tags, matching `assert_can_assign_tags`'s existing coverage), that a `member`-tier student cannot read a bank item under any circumstance, that importing a bank item into a quiz fails if the importing teacher cannot themselves access that item (defense against a teacher guessing another department's bank item id), and that archiving a bank item does not retroactively affect quizzes that already copied from it.

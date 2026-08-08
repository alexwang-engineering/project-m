import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { verifyInstitutionalUser } from '@/lib/auth/admission';
import { isProtectedPath, safeNextPath } from '@/lib/auth/redirects';

const config = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  emailDomain: 'merchanttaylors.com',
  appOrigin: 'https://project-m.example',
};

function user(overrides: Partial<User> = {}): User {
  return {
    app_metadata: { provider: 'azure', providers: ['azure'] },
    email: 'teacher@merchanttaylors.com',
    email_confirmed_at: '2026-08-04T00:00:00Z',
    ...overrides,
  } as User;
}

describe('institutional authentication', () => {
  it('accepts only a verified Azure identity in the exact school domain', () => {
    expect(verifyInstitutionalUser(user(), config)).toEqual({ ok: true });
    expect(
      verifyInstitutionalUser(
        user({ email: 'teacher@merchanttaylors.com.attacker.test' }),
        config,
      ),
    ).toMatchObject({ ok: false });
    expect(
      verifyInstitutionalUser(user({ email_confirmed_at: undefined }), config),
    ).toEqual({ ok: false, code: 'unverified' });
    expect(
      verifyInstitutionalUser(
        user({ app_metadata: { provider: 'google', providers: ['google'] } }),
        config,
      ),
    ).toEqual({ ok: false, code: 'provider' });
  });

  it('prevents OAuth open redirects and callback loops', () => {
    expect(safeNextPath('/chemistry/mechanisms?view=compact')).toBe(
      '/chemistry/mechanisms?view=compact',
    );
    expect(safeNextPath('https://attacker.test/')).toBe('/');
    expect(safeNextPath('//attacker.test/')).toBe('/');
    expect(safeNextPath('/auth/callback?code=stolen')).toBe('/');
    expect(safeNextPath('/safe\\@attacker.test')).toBe('/');
  });

  it('protects private LMS areas while public and guardian entry pages remain readable', () => {
    expect(isProtectedPath('/admin/users')).toBe(true);
    expect(isProtectedPath('/editor/page')).toBe(true);
    expect(isProtectedPath('/assignments/123')).toBe(true);
    expect(isProtectedPath('/quizzes')).toBe(true);
    expect(isProtectedPath('/question-bank')).toBe(true);
    expect(isProtectedPath('/chemistry/mechanisms')).toBe(false);
    expect(isProtectedPath('/parent/login')).toBe(false);
  });
});

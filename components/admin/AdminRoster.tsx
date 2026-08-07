'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

import {
  assignSystemRoleAction,
  assignTagMembershipAction,
  setProfileStateAction,
} from '@/app/actions/admin';
import type { AdminTag, AdminUser } from '@/lib/content/admin';

interface AdminRosterProps {
  users: readonly AdminUser[];
  tags: readonly AdminTag[];
}

const SYSTEM_ROLES = ['institution_admin', 'teacher', 'student'] as const;
const MEMBERSHIP_ROLES = ['member', 'teacher', 'manager'] as const;

const fieldClass =
  'rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px] text-slate-800 outline-none focus:border-brand-400';

function ManageUserPanel({ user, tags }: { user: AdminUser; tags: readonly AdminTag[] }) {
  const [role, setRole] = useState<(typeof SYSTEM_ROLES)[number]>('teacher');
  const [roleReason, setRoleReason] = useState('');
  const [tagId, setTagId] = useState(tags[0]?.id ?? '');
  const [membershipRole, setMembershipRole] = useState<(typeof MEMBERSHIP_ROLES)[number]>('member');
  const [busy, setBusy] = useState<'role' | 'tag' | 'state' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAssignRole() {
    if (!roleReason.trim()) {
      setError('A reason is required to assign a role.');
      return;
    }
    setBusy('role');
    setError(null);
    setMessage(null);
    const result = await assignSystemRoleAction({ profileId: user.id, role, reason: roleReason.trim() });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRoleReason('');
    setMessage(`Granted ${role}.`);
  }

  async function handleAssignTag() {
    if (!tagId) {
      setError('Choose a tag first.');
      return;
    }
    setBusy('tag');
    setError(null);
    setMessage(null);
    const result = await assignTagMembershipAction({ profileId: user.id, tagId, role: membershipRole });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage('Tag membership added.');
  }

  async function handleToggleState() {
    const nextState = user.state === 'active' ? 'disabled' : 'active';
    const reason = window.prompt(
      nextState === 'disabled' ? 'Reason for disabling this account:' : 'Reason for re-enabling this account:',
    );
    if (!reason || !reason.trim()) return;
    setBusy('state');
    setError(null);
    setMessage(null);
    const result = await setProfileStateAction({ profileId: user.id, state: nextState, reason: reason.trim() });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(nextState === 'disabled' ? 'Account disabled.' : 'Account re-enabled.');
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-semibold text-slate-500">Grant role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof SYSTEM_ROLES)[number])}
          className={fieldClass}
        >
          {SYSTEM_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={roleReason}
          onChange={(e) => setRoleReason(e.target.value)}
          placeholder="Reason (required)"
          className={`${fieldClass} flex-1 min-w-[140px]`}
        />
        <button
          type="button"
          onClick={handleAssignRole}
          disabled={busy !== null}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === 'role' && <Loader2 size={12} className="animate-spin" />}
          Grant
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-semibold text-slate-500">Add tag</span>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={fieldClass}>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <select
          value={membershipRole}
          onChange={(e) => setMembershipRole(e.target.value as (typeof MEMBERSHIP_ROLES)[number])}
          className={fieldClass}
        >
          {MEMBERSHIP_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAssignTag}
          disabled={busy !== null || tags.length === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === 'tag' && <Loader2 size={12} className="animate-spin" />}
          Add
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleState}
          disabled={busy !== null}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold disabled:opacity-60 ${
            user.state === 'active'
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {busy === 'state' && <Loader2 size={12} className="animate-spin" />}
          {user.state === 'active' ? 'Disable account' : 'Re-enable account'}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {message && <p className="text-[12px] text-emerald-700">{message}</p>}
    </div>
  );
}

function UserRow({ user, tags }: { user: AdminUser; tags: readonly AdminTag[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-slate-900">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                user.state === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {user.state}
            </span>
            {user.systemRoles.map((role) => (
              <span key={role} className="rounded-md bg-[#eef2fa] px-2 py-0.5 text-[10.5px] font-bold text-[#254889]">
                {role}
              </span>
            ))}
            {user.tagMemberships.map((m) => (
              <span
                key={m.tagId}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-bold text-slate-500"
              >
                {m.tagName} · {m.role}
              </span>
            ))}
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} strokeWidth={2.2} className="flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={16} strokeWidth={2.2} className="flex-shrink-0 text-slate-400" />
        )}
      </button>
      {open && <ManageUserPanel user={user} tags={tags} />}
    </div>
  );
}

export function AdminRoster({ users, tags }: AdminRosterProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {users.map((user) => (
        <UserRow key={user.id} user={user} tags={tags} />
      ))}
    </div>
  );
}

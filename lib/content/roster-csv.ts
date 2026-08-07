export interface RosterMembership {
  readonly tagName: string;
  readonly membershipRole: 'member' | 'teacher' | 'manager';
}

export interface RosterRow {
  readonly email: string;
  readonly systemRole: 'student' | 'teacher';
  readonly memberships: readonly RosterMembership[];
}

/**
 * Parses a roster CSV with header `email,systemRole,tags`, where `tags` is
 * a semicolon-separated list of `TAGNAME` or `TAGNAME:role` pairs (role
 * defaults to `member`). No RFC4180 quoted-field handling - email addresses
 * and this project's tag_name format ([A-Z0-9][A-Z0-9_-]{1,31}) can never
 * contain a comma, so a plain split is sufficient and a full CSV parser
 * would be solving a problem this format doesn't have. Pure and
 * client-safe - this runs in the browser against an uploaded File before
 * the parsed rows are ever sent to the server.
 */
export function parseRosterCsv(text: string): { readonly rows: readonly RosterRow[]; readonly parseErrors: readonly string[] } {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) return { rows: [], parseErrors: ['The file is empty.'] };

  const header = lines[0]!.split(',').map((cell) => cell.trim().toLowerCase());
  const emailIdx = header.indexOf('email');
  const roleIdx = header.indexOf('systemrole');
  const tagsIdx = header.indexOf('tags');
  if (emailIdx === -1 || roleIdx === -1 || tagsIdx === -1) {
    return { rows: [], parseErrors: ['Header row must contain email, systemRole, and tags columns.'] };
  }

  const rows: RosterRow[] = [];
  const parseErrors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(',').map((cell) => cell.trim());
    const lineNumber = i + 1;
    const email = (cells[emailIdx] ?? '').toLowerCase();
    const systemRole = cells[roleIdx] ?? '';
    if (!email) {
      parseErrors.push(`Line ${lineNumber}: missing email.`);
      continue;
    }
    if (systemRole !== 'student' && systemRole !== 'teacher') {
      parseErrors.push(`Line ${lineNumber}: systemRole must be "student" or "teacher".`);
      continue;
    }
    const tagsCell = cells[tagsIdx] ?? '';
    const memberships: RosterMembership[] = [];
    for (const part of tagsCell.split(';').map((p) => p.trim()).filter((p) => p.length > 0)) {
      const [tagName, roleRaw] = part.split(':').map((p) => p.trim());
      const membershipRole = roleRaw || 'member';
      if (!tagName) continue;
      if (membershipRole !== 'member' && membershipRole !== 'teacher' && membershipRole !== 'manager') {
        parseErrors.push(`Line ${lineNumber}: invalid role "${membershipRole}" for tag ${tagName}.`);
        continue;
      }
      memberships.push({ tagName: tagName.toUpperCase(), membershipRole });
    }
    rows.push({ email, systemRole, memberships });
  }
  return { rows, parseErrors };
}

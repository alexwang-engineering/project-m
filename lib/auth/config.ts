import 'server-only';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface InstitutionalAuthConfig {
  readonly tenantId: string;
  readonly emailDomain: string;
  readonly appOrigin: string;
}

/** Returns the validated canonical deployment origin used for auth redirects. */
export function getAppOrigin(): string {
  const rawOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  let origin: URL;
  try {
    origin = new URL(rawOrigin ?? '');
  } catch {
    throw new Error('Institutional SSO is not configured.');
  }
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  ) {
    throw new Error('Institutional SSO is not configured.');
  }
  if (
    origin.protocol !== 'https:' &&
    !(process.env.NODE_ENV !== 'production' && origin.hostname === 'localhost')
  ) {
    throw new Error('Institutional SSO is not configured.');
  }

  return origin.origin;
}

/** Reads the deployment gate for institutional SSO and fails closed if incomplete. */
export function getInstitutionalAuthConfig(): InstitutionalAuthConfig {
  const tenantId = process.env.ENTRA_TENANT_ID?.trim().toLowerCase();
  if (!tenantId || !UUID.test(tenantId))
    throw new Error('Institutional SSO is not configured.');
  return {
    tenantId,
    emailDomain: 'merchanttaylors.com',
    appOrigin: getAppOrigin(),
  };
}

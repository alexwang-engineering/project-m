import 'server-only';

export interface PublicSupabaseEnvironment {
  url: string;
  publishableKey: string;
}

function requireEnvironment(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return normalized;
}

/** Reads public Supabase configuration only when a client is created. */
export function getPublicSupabaseEnvironment(): PublicSupabaseEnvironment {
  return {
    url: requireEnvironment(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requireEnvironment(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

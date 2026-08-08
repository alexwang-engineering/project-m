import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // eslint-config-next already registers the jsx-a11y plugin, but leaves
    // most of its rules off. Turn on the ones that catch real WCAG 2.2 AA
    // failures rather than pulling in the plugin's own "recommended" preset
    // (which conflicts: ESLint flat config forbids re-registering a plugin
    // name two different configs have both already claimed).
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'supabase/.temp/**',
    'supabase/.branches/**',
    // Temporary, gitignored local-login test scaffold (see .gitignore) -
    // never committed, so it doesn't exist in CI, but a contributor's local
    // checkout can have it on disk and it shouldn't fail `npm run check`.
    'app/dev-login/**',
  ]),
]);

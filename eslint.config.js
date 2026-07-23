// @ts-check
import tseslint from 'typescript-eslint';
import browser from './eslint.browser.js';
import extension from './eslint.extension.js';

export default tseslint.config([
  {
    ignores: [
      'dashboard/**/*',
      'extension/**/*',
      'graphics/**/*',
      'shared/dist/**/*',
      'scoreko-wrapper/**/*',
    ],
  },
  browser,
  extension,
]);

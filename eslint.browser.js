// @ts-check
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  extends: defineConfigWithVueTs(
    pluginVue.configs['flat/recommended'],
    vueTsConfigs.recommended,
  ),
  rules: {
    'vue/multi-word-component-names': ['error', { ignores: ['main'] }],
  },
  files: [
    'src/browser_shared/**/*.ts',
    'src/browser_shared/**/*.vue',
    'src/dashboard/**/*.ts',
    'src/dashboard/**/*.vue',
    'src/graphics/**/*.ts',
    'src/graphics/**/*.vue',
  ],
});

import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import NodeCGPlugin from 'vite-plugin-nodecg';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
  },
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({
      autoImportComponentCase: 'pascal',
      sassVariables: fileURLToPath(
        new URL('./src/dashboard/quasar-variables.sass', import.meta.url)
      )
    }),
    checker({ vueTsc: { tsconfigPath: 'tsconfig.browser.json' } }),
    NodeCGPlugin({
      inputs: {
        'graphics/*/main.ts': './src/graphics/template.html',
        'dashboard/*/main.ts': './src/dashboard/template.html',
      },
    }),
  ],
});

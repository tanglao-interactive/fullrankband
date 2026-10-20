import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig(({ command, mode }) => {
  const cloud = mode === 'sandbox' || (command === 'build' && mode !== 'offline');
  const outputs = resolve('amplify_outputs.json');
  if (cloud && !existsSync(outputs)) throw new Error('Amplify outputs missing. Run npm run sandbox first, or use npm run build:local for an offline preview.');
  if (cloud) { const config = JSON.parse(readFileSync(outputs, 'utf8')); if (!config.auth?.user_pool_id || !config.data?.url || !config.storage?.bucket_name) throw new Error('Amplify sandbox deployment has not finished. Wait for valid outputs before starting the AWS frontend.'); }
  return {
    plugins: [{ name: 'fullrank-amplify-config',
      resolveId(id) { return id === 'virtual:amplify-config' ? '\0virtual:amplify-config' : null; },
      load(id) { if (id === '\0virtual:amplify-config') return `export default ${cloud ? readFileSync(outputs, 'utf8') : 'null'};`; },
    }],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: { rollupOptions: { input: { home: resolve('index.html'), admin: resolve('admin/index.html') } } },
  };
});

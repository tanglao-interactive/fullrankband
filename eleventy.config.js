import { build } from 'esbuild';
import { existsSync, readFileSync, rmSync } from 'node:fs';

export default function (eleventyConfig) {
  let firstBuild = true;
  eleventyConfig.setChokidarConfig({ usePolling: true, interval: 500 });
  eleventyConfig.addPassthroughCopy({ public: '.' });
  eleventyConfig.addWatchTarget('src/');
  eleventyConfig.addWatchTarget('amplify_outputs.json');
  eleventyConfig.on('eleventy.before', async () => {
    if (firstBuild) { rmSync('dist', { recursive: true, force: true }); firstBuild = false; }
    const offline = process.env.FULLRANK_OFFLINE === '1';
    let outputs = null;
    if (!offline) {
      if (!existsSync('amplify_outputs.json')) throw new Error('Amplify outputs missing. Run npm run sandbox, or npm run build:local for an offline preview.');
      outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
      if (!outputs.auth?.user_pool_id || !outputs.data?.url || !outputs.storage?.bucket_name) throw new Error('Amplify backend outputs are incomplete.');
    }
    await build({
      entryPoints: { site: 'src/site.js', admin: 'src/admin.js' },
      outdir: 'dist/scripts', bundle: true, splitting: true, format: 'esm',
      target: 'es2022', minify: true,
      plugins: [{ name: 'amplify-config', setup(builder) {
        builder.onResolve({ filter: /^virtual:amplify-config$/ }, () => ({ path: 'config', namespace: 'amplify' }));
        builder.onLoad({ filter: /.*/, namespace: 'amplify' }, () => ({ contents: `export default ${JSON.stringify(outputs)};`, loader: 'js' }));
      } }],
    });
  });
  return { dir: { input: 'site', output: 'dist' }, templateFormats: ['njk'] };
}

const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/zoho/nestjs',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/zoho/nestjs',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm', 'cjs'],
  external: 'all',
  buildLibsFromSource: false,
  generateExportsField: true,
  optimization: true,
  sourceMap: false,
  extractLicenses: true,
  assets: [
    { glob: 'packages/zoho/nestjs/README.md', input: '.', output: '.' },
    { glob: 'LICENSE', input: '.', output: '.' },
    { glob: '**/*.md', input: 'packages/zoho/nestjs/docs', output: 'docs' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();

// Shared rollup config modifier that adds the visualizer plugin.
// CommonJS form so the `@nx/rollup/plugin` inferred `rollup.config.cjs` files can `require()` it.
// (The `@nx/rollup:rollup` executor's "rollupConfig" hook used the .ts sibling of this file.)
const importEsm = new Function('modulePath', 'return import(modulePath)');

module.exports = async (config, options) => {
  const { visualizer } = await importEsm('rollup-plugin-visualizer');
  const name = (options?.importPath ?? 'stats').replaceAll(/[@/]/g, '-');

  config.plugins = [...(Array.isArray(config.plugins) ? config.plugins : []), visualizer({ filename: `./.stats/rollup/${name}.html` })];

  return config;
};

// Shared rollup config modifier that adds the visualizer plugin.
// Reference this from project.json "rollupConfig" to generate stats.
// Usage: "rollupConfig": ["rollup.visualizer.config.ts"]
const importEsm = new Function('modulePath', 'return import(modulePath)');

export default async (config: any, options: any) => {
  const { visualizer } = await importEsm('rollup-plugin-visualizer');
  const name = (options?.importPath ?? 'stats').replace(/[@/]/g, '-');

  config.plugins = [...(Array.isArray(config.plugins) ? config.plugins : []), visualizer({ filename: `./.stats/rollup/${name}.html` })];

  return config;
};

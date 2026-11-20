import basePackageConfig, { llmEntryBoundaryConfig, LLM_ENTRY_BANS } from '../eslint.config.mjs';

const { openaiSdk, openrouterSdk, openrouterPackage, decisionSubpath, testRunner, sibling, self } = LLM_ENTRY_BANS;

export default [
  ...basePackageConfig,
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: true,
    everywhere: [openrouterPackage, sibling('openai'), sibling('openrouter'), sibling('node')],
    sources: [openaiSdk, openrouterSdk, decisionSubpath, sibling('test'), self('@dereekb/llm/zenmux'), testRunner]
  })
];

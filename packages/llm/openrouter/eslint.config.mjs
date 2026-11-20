import basePackageConfig, { llmEntryBoundaryConfig, LLM_ENTRY_BANS } from '../eslint.config.mjs';

const { openaiSdkThroughOpenAiEntry, openrouterSdk, openrouterPackage, decisionSubpath, testRunner, sibling, self } = LLM_ENTRY_BANS;

export default [
  ...basePackageConfig,
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: true,
    everywhere: [openrouterPackage, openrouterSdk, sibling('zenmux'), sibling('node')],
    sources: [openaiSdkThroughOpenAiEntry, decisionSubpath, sibling('test'), self('@dereekb/llm/openrouter'), testRunner]
  })
];

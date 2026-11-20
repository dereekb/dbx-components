import basePackageConfig, { llmEntryBoundaryConfig, LLM_ENTRY_BANS } from '../eslint.config.mjs';

const { openaiSdk, openrouterSdk, openrouterPackage, decisionSubpath, testRunner, sibling, self } = LLM_ENTRY_BANS;

// a Node entry (no browser rules); @dereekb/llm/craft stays legal
export default [
  ...basePackageConfig,
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: false,
    everywhere: [openrouterPackage, sibling('openai'), sibling('openrouter'), sibling('zenmux'), sibling('test')],
    sources: [openaiSdk, openrouterSdk, decisionSubpath, self('@dereekb/llm/node'), testRunner]
  })
];

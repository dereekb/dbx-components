import basePackageConfig, { llmEntryBoundaryConfig, LLM_ENTRY_BANS } from '../eslint.config.mjs';

const { openaiSdk, openrouterSdk, openrouterPackage, decisionSubpath, testRunner, sibling, self } = LLM_ENTRY_BANS;

// a Node entry (no browser rules); it never imports a provider entry, so no spec can build a real transport
export default [
  ...basePackageConfig,
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: false,
    everywhere: [openrouterPackage, sibling('openai'), sibling('openrouter'), sibling('zenmux')],
    sources: [openaiSdk, openrouterSdk, decisionSubpath, self('@dereekb/llm/test'), testRunner]
  })
];

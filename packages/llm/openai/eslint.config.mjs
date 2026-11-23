import basePackageConfig, { llmEntryBoundaryConfig, LLM_ENTRY_BANS } from '../eslint.config.mjs';

const { openaiSdk, openrouterSdk, openrouterPackage, decisionSubpath, testRunner, sibling, self } = LLM_ENTRY_BANS;
const SOURCES_BUT_SDK = [openrouterSdk, decisionSubpath, sibling('test'), self('@dereekb/llm/openai'), testRunner];

export default [
  ...basePackageConfig,
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: true,
    everywhere: [openrouterPackage, sibling('openrouter'), sibling('zenmux'), sibling('node')],
    sources: [openaiSdk, ...SOURCES_BUT_SDK],
    // the SDK boundary: the one module that may reach openai, as an erased type or a deferred import()
    scopes: [{ files: ['lib/openai.sdk.ts'], sources: [{ ...openaiSdk, allowTypeImports: true, allowImportExpression: true }, ...SOURCES_BUT_SDK] }]
  })
];

import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'llm-openrouter',
  test: {
    // the isolation spec mocks the SDK ids (`openai`, `@openrouter/sdk`); keep that mock out of other spec files in CI
    isolate: true
  }
});

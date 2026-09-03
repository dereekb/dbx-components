import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'nestjs',
  pathFromRoot: import.meta.dirname,
  projectName: 'zoho'
});

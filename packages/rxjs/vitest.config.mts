import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'rxjs',
  /**
   * The LoadingState generic typings are asserted at the type level in
   * `src/lib/loading/loading.state.types.spec.ts`; nothing else in the suite catches a silent widening
   * to `unknown` or a dropped `page` key, since both still compile and still pass at runtime.
   */
  typecheck: true
});

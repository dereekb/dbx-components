/**
 * Shared types for `dbx_server_actions_list_app`.
 *
 * The tool walks `<apiDir>/src/app/common/model/**\/*.action.server.ts`
 * for `*ServerActions` abstract class declarations and reports each
 * with its NestJS module wiring, barrel export, and test-fixture
 * coverage.
 */

/**
 * Wiring status of a `*ServerActions` class against its sibling
 * NestJS module.
 */
export interface ServerActionModuleWiring {
  /**
   * Sibling `*.module.ts` path (relative to the API root) that we
   * inspected. `undefined` when no sibling module file exists.
   */
  readonly modulePath: string | undefined;
  /**
   * `true` when the sibling module's `providers` array binds the
   * class via `provide: <Class>`.
   */
  readonly providedByModule: boolean;
  /**
   * `true` when the sibling module's `exports` array surfaces the
   * class. Surfaces "internal-only" wiring vs. cross-module reuse.
   */
  readonly exportedByModule: boolean;
}

/**
 * Test-fixture coverage status for a `*ServerActions` class.
 */
export interface ServerActionFixtureCoverage {
  /**
   * Whether the fixture file's primary context interface declares
   * a `<getterName>` getter that returns the class.
   */
  readonly contextInterfaceDeclaresGetter: boolean;
  /**
   * Whether the four fixture/instance classes (Fixture and
   * FixtureInstance for both Admin and AdminFunction) each
   * implement the `<getterName>` getter. An empty array means
   * "all classes implement it"; non-empty lists the missing class
   * names.
   */
  readonly classesMissingGetter: readonly string[];
  /**
   * The expected getter name (camelCase form of the class name).
   */
  readonly expectedGetterName: string;
}

/**
 * One `*ServerActions` abstract class found in the API.
 */
export interface ServerActionEntry {
  readonly className: string;
  readonly sourceFile: string;
  /**
   * Camelcase getter name we'd expect on the API context
   * interface (e.g. `ProfileServerActions` → `profileServerActions`).
   */
  readonly expectedGetterName: string;
  readonly wiring: ServerActionModuleWiring;
  /**
   * `true` when the class is re-exported from
   * `src/app/common/index.ts` (or the closest barrel up to two
   * directories above the action file). Surfaces "available
   * outside this folder" status.
   */
  readonly exportedFromCommonBarrel: boolean;
  /**
   * Fixture coverage status — `undefined` when the fixture file
   * couldn't be read.
   */
  readonly fixtureCoverage: ServerActionFixtureCoverage | undefined;
}

/**
 * Aggregate report.
 */
export interface ServerActionsReport {
  readonly apiDir: string;
  readonly modelRoot: string;
  readonly entries: readonly ServerActionEntry[];
  readonly fixtureStatus: 'ok' | { readonly kind: 'error'; readonly message: string };
}

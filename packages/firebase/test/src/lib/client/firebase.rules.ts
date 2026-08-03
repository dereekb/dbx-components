import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Maybe } from '@dereekb/util';
import { type EmulatorConfig, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment, type TokenOptions } from '@firebase/rules-unit-testing';
import { type Firestore } from 'firebase/firestore';

export { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

/**
 * Default file name of the workspace's Firestore security rules.
 */
export const DEFAULT_FIRESTORE_RULES_FILE_NAME = 'firestore.rules';

/**
 * Configuration for {@link readFirestoreRulesFile}.
 */
export interface ReadFirestoreRulesFileConfig {
  /**
   * A path or `import.meta.url` to begin searching upward from.
   *
   * Resolve from the calling module rather than `process.cwd()`: vitest sets `root` to the project
   * directory, so the working directory is not the workspace root when specs run.
   */
  readonly from: string;
  /**
   * File name to look for. Defaults to `firestore.rules`.
   */
  readonly fileName?: Maybe<string>;
}

/**
 * Reads the workspace's Firestore rules file by walking up from the given module/path.
 *
 * @param config - The starting location and optional file name.
 * @returns The contents of the rules file.
 * @throws {Error} When no rules file is found at or above the starting location.
 */
export function readFirestoreRulesFile(config: ReadFirestoreRulesFileConfig): string {
  const { from, fileName = DEFAULT_FIRESTORE_RULES_FILE_NAME } = config;
  const startPath = from.startsWith('file:') ? dirname(fileURLToPath(from)) : from;

  let directory = startPath;
  let found: Maybe<string> = null;

  // walk up to the filesystem root looking for the rules file.
  while (!found) {
    const candidate = join(directory, fileName ?? DEFAULT_FIRESTORE_RULES_FILE_NAME);

    if (existsSync(candidate)) {
      found = candidate;
    } else {
      const parent = dirname(directory);

      if (parent === directory) {
        break;
      }

      directory = parent;
    }
  }

  if (!found) {
    throw new Error(`readFirestoreRulesFile(): could not find "${fileName}" at or above "${startPath}".`);
  }

  return readFileSync(found, 'utf8');
}

/**
 * Configuration for {@link firestoreRulesTestBuilder}.
 */
export interface FirestoreRulesTestConfig {
  /**
   * Explicit project id for the rules test environment.
   *
   * Rules tests must not share a project id with other suites, since documents seeded with rules
   * disabled would otherwise be visible across suites.
   */
  readonly projectId: string;
  /**
   * The Firestore security rules source to load. See {@link readFirestoreRulesFile}.
   */
  readonly rules: string;
  /**
   * Optional emulator connection details. Defaults to the emulator config in the environment.
   */
  readonly firestore?: Maybe<EmulatorConfig>;
}

/**
 * Fixture handed to a {@link firestoreRulesTestBuilder} test body.
 *
 * Exposes RAW `firebase/firestore` handles rather than a `TestFirestoreContext`: the
 * `firebaseRulesUnitTestBuilder()` drivers wrap every collection path with
 * `makeTestingFirestoreAccesorDriver`, which fuzzes it to `${time}_${random}_${path}_${n}` — a
 * fuzzed path can never match a `match /uec/{id}` rule, so those drivers cannot test rules.
 */
export interface FirestoreRulesTestFixture {
  /**
   * The underlying rules test environment.
   */
  readonly rulesTestEnvironment: RulesTestEnvironment;
  /**
   * Returns a Firestore handle authenticated as the given user.
   *
   * @param userId - The uid to authenticate as.
   * @param tokenOptions - Optional additional auth token claims.
   * @returns A Firestore instance subject to the loaded security rules.
   */
  firestoreForUser(userId: string, tokenOptions?: Maybe<TokenOptions>): Firestore;
  /**
   * Returns an unauthenticated Firestore handle.
   *
   * @returns A Firestore instance subject to the loaded security rules.
   */
  unauthenticatedFirestore(): Firestore;
  /**
   * Runs the given function with security rules disabled, for seeding documents.
   *
   * @param fn - Receives a rules-bypassing Firestore instance.
   * @returns A promise that resolves when the seeding completes.
   */
  withSecurityRulesDisabled(fn: (firestore: Firestore) => Promise<void>): Promise<void>;
}

/**
 * Registers vitest hooks that initialize a Firestore security-rules test environment, and invokes
 * the given callback with a {@link FirestoreRulesTestFixture}.
 *
 * The environment is created once per suite (`beforeAll`), torn down once (`afterAll`), and the
 * Firestore data is cleared between tests (`beforeEach`).
 *
 * @param config - The project id and rules to load.
 * @returns A function that takes the test body builder.
 *
 * @example
 * ```ts
 * const rulesTest = firestoreRulesTestBuilder({
 *   projectId: 'demo-api-rules-test',
 *   rules: readFirestoreRulesFile({ from: import.meta.url })
 * });
 *
 * describe('firestore.rules', () => {
 *   rulesTest((f) => {
 *     it('allows the owner to read their own document', async () => {
 *       await assertSucceeds(getDoc(doc(f.firestoreForUser('a'), 'uec', 'a')));
 *     });
 *   });
 * });
 * ```
 */
export function firestoreRulesTestBuilder(config: FirestoreRulesTestConfig): (buildTests: (fixture: FirestoreRulesTestFixture) => void) => void {
  const { projectId, rules, firestore } = config;

  return (buildTests: (fixture: FirestoreRulesTestFixture) => void) => {
    let rulesTestEnvironment: RulesTestEnvironment;

    const contextFirestore = (context: RulesTestContext) => context.firestore() as unknown as Firestore;

    const fixture: FirestoreRulesTestFixture = {
      get rulesTestEnvironment() {
        return rulesTestEnvironment;
      },
      firestoreForUser: (userId: string, tokenOptions?: Maybe<TokenOptions>) => contextFirestore(rulesTestEnvironment.authenticatedContext(userId, tokenOptions ?? undefined)),
      unauthenticatedFirestore: () => contextFirestore(rulesTestEnvironment.unauthenticatedContext()),
      withSecurityRulesDisabled: (fn: (firestore: Firestore) => Promise<void>) => rulesTestEnvironment.withSecurityRulesDisabled((context) => fn(contextFirestore(context)))
    };

    beforeAll(async () => {
      rulesTestEnvironment = await initializeTestEnvironment({
        projectId,
        firestore: {
          rules,
          ...firestore
        }
      });
    });

    afterAll(async () => {
      if (rulesTestEnvironment) {
        await rulesTestEnvironment.cleanup().catch((e) => {
          console.warn('firestoreRulesTestBuilder(): Failed to cleanup rules test environment', e);
          throw e;
        });
      }
    });

    beforeEach(async () => {
      await rulesTestEnvironment.clearFirestore();
    });

    buildTests(fixture);
  };
}

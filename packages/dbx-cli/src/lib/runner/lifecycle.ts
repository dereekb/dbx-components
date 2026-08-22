import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type CliContext } from '../context/cli.context';
import { verboseLog } from '../util/output';

/**
 * Input handed to a {@link CliSetupFunction} / {@link CliTeardownFunction}.
 */
export interface CliLifecycleHookInput {
  readonly cliName: string;
  /**
   * The invocation's {@link CliContext}, when one was built.
   *
   * Absent for an auth-bypassed command (`auth login`, `env list`, `firestore-queries`), and for a
   * teardown that runs after authentication itself failed. A hook that needs the context should say
   * so by throwing from `setup`, which aborts the command with an error envelope — a `teardown` must
   * tolerate its absence, since it runs on paths `setup` never reached.
   */
  readonly context: Maybe<CliContext>;
}

/**
 * App-supplied hook run once per invocation, after the command's arguments validate and the auth
 * middleware has attached the {@link CliContext}, and before the command's handler.
 *
 * Runs inside the parser, so throwing aborts the command: the error is emitted as the standard error
 * envelope and the process exits non-zero, with {@link CliTeardownFunction} still run. That makes it
 * the right place for a precondition an app's commands all depend on.
 */
export type CliSetupFunction = (input: CliLifecycleHookInput) => PromiseOrValue<void>;

/**
 * App-supplied hook run once per invocation after the parser has fully settled, on both the success
 * and the failure path, and BEFORE the CLI closes its direct-Firestore session — so the hook can
 * still read Firestore through `input.context`.
 *
 * Best-effort, exactly like the built-in session teardown it precedes: it runs after the command's
 * result is already on stdout, so a throw is swallowed (surfaced under `--verbose`) rather than
 * changing what the caller sees or the exit code they get.
 *
 * A teardown may run when {@link CliSetupFunction} did NOT — an invocation that failed validation or
 * authentication never reaches setup — so it must not assume setup's side effects are in place.
 */
export type CliTeardownFunction = (input: CliLifecycleHookInput) => PromiseOrValue<void>;

/**
 * The app-supplied lifecycle hooks accepted by `createCli` / `runCli`.
 */
export interface CliLifecycleHooks {
  /**
   * Run once before the command's handler. See {@link CliSetupFunction}.
   */
  readonly setup?: Maybe<CliSetupFunction>;
  /**
   * Run once after the parser settles, before the direct-Firestore session is closed. See
   * {@link CliTeardownFunction}.
   */
  readonly teardown?: Maybe<CliTeardownFunction>;
}

/**
 * Input for {@link cliLifecycleRunner}.
 */
export interface CliLifecycleRunnerInput extends CliLifecycleHooks {
  readonly cliName: string;
}

/**
 * The once-per-invocation view of an app's {@link CliLifecycleHooks}.
 */
export interface CliLifecycleRunner {
  /**
   * Runs the app's `setup` hook, at most once, rethrowing whatever it throws.
   */
  readonly runSetup: (context: Maybe<CliContext>) => Promise<void>;
  /**
   * Runs the app's `teardown` hook, at most once, swallowing whatever it throws.
   */
  readonly runTeardown: (context: Maybe<CliContext>) => Promise<void>;
}

/**
 * Wraps an app's lifecycle hooks so each runs at most once per process.
 *
 * The once-only guard is not a convenience: yargs re-runs a global middleware for every COMMAND
 * LEVEL it parses, so a nested command (`action worker export`) enters the setup middleware three
 * times. An app's `setup` is written as "prepare this invocation", not "prepare this command level",
 * and a hook that opened a connection or wrote a file would do it three times over.
 *
 * @param input - The CLI name and the app's hooks.
 * @returns The guarded runner.
 * @__NO_SIDE_EFFECTS__
 */
export function cliLifecycleRunner(input: CliLifecycleRunnerInput): CliLifecycleRunner {
  const { cliName, setup, teardown } = input;
  let setupRan = false;
  let teardownRan = false;

  async function runSetup(context: Maybe<CliContext>): Promise<void> {
    if (setup != null && !setupRan) {
      // marked BEFORE awaiting: a setup that throws must not be retried by the next command level's
      // middleware run, which would report the same failure twice
      setupRan = true;
      await setup({ cliName, context });
    }
  }

  async function runTeardown(context: Maybe<CliContext>): Promise<void> {
    if (teardown != null && !teardownRan) {
      teardownRan = true;

      try {
        await teardown({ cliName, context });
      } catch (e) {
        // best-effort by contract — the command's result is already emitted, so this cannot be
        // allowed to change the exit code. Visible under `--verbose` so it is still debuggable.
        verboseLog(`cli teardown hook failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { runSetup, runTeardown };
}

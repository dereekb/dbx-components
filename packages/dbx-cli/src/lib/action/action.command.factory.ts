import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { outputError, outputResult } from '../util/output';

/**
 * Specification for a composite action command surfaced under `<cli> action ...`.
 *
 * Actions are user-defined async lambdas that chain multiple {@link CliContext.callModel} /
 * {@link CliContext.getModel} / {@link CliContext.getMultipleModels} calls in-process,
 * letting consumers expose high-leverage workflows (paginate-and-aggregate, fan-out,
 * derived projections) without spending a CLI round-trip per call.
 *
 * Each action runs after the standard auth middleware, so the {@link CliContext} is
 * already populated by the time {@link ActionCommandSpec.handler} fires.
 *
 * @example
 * ```ts
 * const districtsForRegion: ActionCommandSpec = {
 *   command: 'districts <region>',
 *   describe: 'List every District in a Region.',
 *   model: 'region',
 *   builder: (y) => y.positional('region', { type: 'string' }),
 *   handler: async ({ context, argv }) => {
 *     const region = String(argv.region);
 *     return context.callModel({ modelType: 'district', call: 'query', data: { region } });
 *   }
 * };
 * ```
 */
export interface ActionCommandSpec<TArgv = any, TResult = unknown> {
  /**
   * Yargs command string for the action's leaf — positionals come after the action name.
   * Example: `'open-jobs-for-region <region>'` resolves to `<cli> action open-jobs-for-region <region>`
   * (or `<cli> action <model> open-jobs-for-region <region>` when {@link model} is set).
   */
  readonly command: string;
  /**
   * Short one-line description shown in `<cli> action --help`.
   */
  readonly describe: string;
  /**
   * When provided, the action is grouped under `<cli> action <model> <action>` instead of
   * the root `<cli> action <action>`. Use the model's persisted type (e.g. `'region'`,
   * `'district'`) so the grouping mirrors `model <model>` from {@link buildManifestCommands}.
   */
  readonly model?: string;
  /**
   * Optional yargs builder. Use to declare positionals and options that the action consumes.
   */
  readonly builder?: (yargs: Argv) => Argv;
  /**
   * Optional epilogue rendered after `--help` for this action.
   */
  readonly helpEpilogue?: string;
  /**
   * The action body. Receives the live {@link CliContext} (auth already resolved) and the
   * parsed argv. Throwing a {@link CliError} surfaces a structured failure envelope.
   */
  readonly handler: (input: { readonly context: CliContext; readonly argv: TArgv }) => Promise<TResult> | TResult;
  /**
   * Optional result transform applied before {@link outputResult} serialises the value.
   * Use to strip noise (e.g. paging cursors) or shape the response for downstream callers.
   */
  readonly mapResult?: (result: TResult) => unknown;
}

/**
 * Wraps an {@link ActionCommandSpec} as a yargs `CommandModule`.
 *
 * The returned command:
 *  - Calls {@link requireCliContext} so it fails loudly when auth middleware did not run.
 *  - Invokes `spec.handler({ context, argv })`.
 *  - Pipes the result through `spec.mapResult` when provided.
 *  - Emits the value via {@link outputResult}; emits {@link outputError} + `process.exit(1)` on failure.
 *
 * @param spec - The action specification.
 * @returns The yargs command module ready to be registered under the `action` parent.
 * @__NO_SIDE_EFFECTS__
 */
export function createActionCommand<TArgv = any, TResult = unknown>(spec: ActionCommandSpec<TArgv, TResult>): CommandModule {
  return {
    command: spec.command,
    describe: spec.describe,
    builder: (yargs: Argv) => {
      const built = spec.builder ? spec.builder(yargs) : yargs;
      return spec.helpEpilogue ? built.epilogue(spec.helpEpilogue) : built;
    },
    handler: async (argv: any) => {
      try {
        const context = requireCliContext();
        const result = await spec.handler({ context, argv });
        outputResult(spec.mapResult ? spec.mapResult(result) : result);
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };
}

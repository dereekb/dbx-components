import type { Argv, CommandModule } from 'yargs';
import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { outputError, outputResult } from '../util/output';

export interface CallModelCommandSpec<TParams = unknown, TResult = unknown> {
  /**
   * The yargs command string (e.g. `'profile read username <value>'`).
   */
  readonly command: string;
  readonly describe: string;
  /**
   * The Firestore model type (e.g. `'profile'`).
   */
  readonly model: string;
  /**
   * The CRUD verb (`'create' | 'read' | 'update' | 'delete' | 'query'`) or a custom action type.
   */
  readonly verb: string;
  /**
   * Optional sub-function specifier (e.g. `'username'`).
   */
  readonly specifier?: string;
  /**
   * Optional yargs option/positional builder for the command.
   */
  readonly builder?: (yargs: Argv) => Argv;
  /**
   * Maps the parsed argv to the typed call payload.
   */
  readonly buildParams: (argv: any) => TParams;
  /**
   * Optional transform applied before printing the result envelope.
   */
  readonly mapResult?: (result: TResult) => unknown;
}

/**
 * Builder primitive: turns a {@link CallModelCommandSpec} into a yargs `CommandModule`.
 *
 * The handler reads the {@link CliContext} (built by the auth middleware), constructs the
 * {@link OnCallTypedModelParams} envelope, and executes via `context.callModel(...)`.
 */
export function createCallModelCommand<TParams = unknown, TResult = unknown>(spec: CallModelCommandSpec<TParams, TResult>): CommandModule {
  return {
    command: spec.command,
    describe: spec.describe,
    builder: (yargs: Argv) => (spec.builder ? spec.builder(yargs) : yargs),
    handler: async (argv: any) => {
      try {
        const context = requireCliContext();
        const data = spec.buildParams(argv);

        const params: OnCallTypedModelParams<TParams> = {
          modelType: spec.model,
          call: spec.verb,
          ...(spec.specifier != null ? { specifier: spec.specifier } : {}),
          data
        };

        const result = await context.callModel<TParams, TResult>(params);
        outputResult(spec.mapResult ? spec.mapResult(result) : result);
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };
}

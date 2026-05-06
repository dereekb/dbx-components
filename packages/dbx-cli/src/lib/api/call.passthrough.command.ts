import type { Argv, CommandModule } from 'yargs';
import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { CliError, outputError, outputResult } from '../util/output';
import { withCallModelArgs } from '../util/args';

/**
 * Generic `call <model> <verb> [specifier] --data <json>` passthrough.
 *
 * Provides direct access to the demo-api's typed model dispatch without typed wrappers — useful
 * for ad-hoc admin tasks, scripting, and the MVP demo CLI before model-specific commands ship.
 */
export const callPassthroughCommand: CommandModule = {
  command: 'call <model> <verb> [specifier]',
  describe: 'POST a typed model call: { modelType, call, specifier?, data } — generic passthrough',
  builder: (yargs: Argv) => withCallModelArgs(yargs),
  handler: async (argv: any) => {
    try {
      const context: CliContext = requireCliContext();

      let data: unknown = {};

      if (typeof argv.data === 'string' && argv.data.length > 0) {
        try {
          data = JSON.parse(argv.data);
        } catch (e) {
          throw new CliError({
            message: `--data must be valid JSON: ${e instanceof Error ? e.message : String(e)}`,
            code: 'INVALID_DATA_JSON'
          });
        }
      }

      const params: OnCallTypedModelParams = {
        modelType: argv.model,
        call: argv.verb,
        ...(argv.specifier != null ? { specifier: argv.specifier } : {}),
        data
      };

      const result = await context.callModel(params);
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

import type { Argv, CommandModule } from 'yargs';
import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { withCallModelArgs } from '../util/args';
import { isStdinSentinel, readAllStdin } from '../util/stdin';

/**
 * Generic `call <model> <verb> [specifier] --data <json>` passthrough.
 *
 * Provides direct access to the demo-api's typed model dispatch without typed wrappers — useful
 * for ad-hoc admin tasks, scripting, and the MVP demo CLI before model-specific commands ship.
 */
export const CALL_PASSTHROUGH_COMMAND: CommandModule = {
  command: 'call <model> <verb> [specifier]',
  describe: 'POST a typed model call: { modelType, call, specifier?, data } — generic passthrough',
  builder: (yargs: Argv) => withCallModelArgs(yargs),
  handler: wrapCommandHandler(async (argv: any) => {
    const context: CliContext = requireCliContext();

    let data: unknown = {};
    let rawData: string | undefined;

    if (typeof argv.data === 'string' && argv.data.length > 0) {
      rawData = isStdinSentinel(argv.data) ? (await readAllStdin()).trim() : argv.data;
    }

    if (rawData) {
      try {
        data = JSON.parse(rawData);
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
      ...(argv.specifier == null ? {} : { specifier: argv.specifier }),
      data
    };

    const result = await context.callModel(params);
    outputResult(result);
  })
};

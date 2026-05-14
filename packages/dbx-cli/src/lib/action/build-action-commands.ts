import type { Argv, CommandModule } from 'yargs';
import { type ActionCommandSpec, createActionCommand } from './action.command.factory';

/**
 * Default name of the parent command that groups all registered action specs.
 * Surfaces as `<cli> action <action>` (root) and `<cli> action <model> <action>` (model-scoped).
 */
export const DEFAULT_ACTION_COMMAND_NAME = 'action';

/**
 * Options accepted by {@link buildActionCommands}.
 */
export interface BuildActionCommandsOptions {
  /**
   * Name of the parent command that groups all action specs. Defaults to
   * {@link DEFAULT_ACTION_COMMAND_NAME} (`action`).
   */
  readonly actionCommandName?: string;
}

/**
 * Assembles the parent `action` command tree from a list of {@link ActionCommandSpec}s.
 *
 * Specs without a `model` are appended as direct subcommands of `action`. Specs with a
 * `model` are grouped under `action <model> <action>` (mirroring `buildManifestCommands`'
 * `model <model> <action>` shape) so the model-scoped surface stays browseable.
 *
 * @param specs - The action specs registered by the app.
 * @param options - Optional overrides (e.g. parent command name).
 * @returns An array containing a single parent `action` command, or empty when no specs were provided.
 * @__NO_SIDE_EFFECTS__
 */
export function buildActionCommands(specs: readonly ActionCommandSpec[], options?: BuildActionCommandsOptions): CommandModule[] {
  let result: CommandModule[] = [];

  if (specs.length > 0) {
    const actionCommandName = options?.actionCommandName ?? DEFAULT_ACTION_COMMAND_NAME;
    const rootSpecs = specs.filter((s) => !s.model);
    const byModel = new Map<string, ActionCommandSpec[]>();

    for (const spec of specs) {
      if (spec.model) {
        const list = byModel.get(spec.model);

        if (list) {
          list.push(spec);
        } else {
          byModel.set(spec.model, [spec]);
        }
      }
    }

    const sortedModels = [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b));

    result = [
      {
        command: `${actionCommandName} <action>`,
        describe: `Run a composite action (${specs.length}). Use \`${actionCommandName} --help\` to list them.`,
        builder: (yargs: Argv) => {
          for (const spec of rootSpecs) {
            yargs.command(createActionCommand(spec));
          }

          for (const [model, modelSpecs] of sortedModels) {
            yargs.command({
              command: `${model} <action>`,
              describe: `Composite actions scoped to model '${model}' (${modelSpecs.length}).`,
              builder: (yy: Argv) => {
                for (const spec of modelSpecs) {
                  yy.command(createActionCommand(spec));
                }

                return yy.demandCommand(1, 'Please specify an action.');
              },
              handler: () => undefined
            });
          }

          return yargs.demandCommand(1, 'Please specify an action.');
        },
        handler: () => undefined
      }
    ];
  }

  return result;
}

/**
 * `dbx-components-cli setup …` — the deterministic dbx-components project setup
 * command group, the in-process successor to `setup/setup-project.sh`.
 *
 * Per-module commands (`firebase-components`, `app-components`, `api`, `app`,
 * `root`, `workspace`, `integrations`) each run the phases
 * generate → install → scaffold → configure (individually skippable);
 * `--templates-only` runs just the deterministic scaffold and `--dry-run` prints
 * the plan without touching disk. `setup validate` checks the expected structure;
 * `setup manifest` reads/derives/writes `dbx.setup.json`; `setup init` runs the
 * whole ordered sequence.
 */

import { type ArgumentsCamelCase, type Argv, type CommandModule } from 'yargs';
import { runCommand } from '../lib/run.js';
import { resolveSetupContext, type ResolveSetupContextInput } from '../lib/setup/resolve.js';
import { moduleExpectedFiles, runModulePhases, runModuleScaffold, type SetupContext, type SetupModuleId } from '../lib/setup/module.js';
import { SCAFFOLDING_MODULE_IDS, SETUP_MODULES, SETUP_MODULE_IDS } from '../lib/setup/modules/index.js';
import { formatValidationMarkdown, validateExpectedFiles, validationHasMissing, type ModuleValidationResult } from '../lib/setup/validate.js';
import { assertManifestFields, DBX_SETUP_MANIFEST_FILENAME, readManifest, withInstalledAddon, writeManifest } from '../lib/setup/manifest.js';
import { type ScaffoldWriteResult } from '../lib/setup/scaffold.js';
import { runSetupInit, type SetupInitFlags } from '../lib/setup/init.js';
import { addonExpectedFiles, runAddon, unmetAddonDependencies, type AddonContext, type SetupAddonId } from '../lib/setup/addon.js';
import { SETUP_ADDONS, SETUP_ADDON_IDS } from '../lib/setup/addons/index.js';
import { formatManualInjectionInstructions } from '../lib/setup/source-inject.js';

interface CommonSetupArgs {
  readonly firebaseProjectId?: string;
  readonly projectName?: string;
  readonly codePrefix?: string;
  readonly emulatorPort?: number;
  readonly stagingProjectId?: string;
  readonly dir: string;
  readonly branch?: string;
  readonly componentsVersion?: string;
  readonly ciTest: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
}

interface ModuleArgs extends CommonSetupArgs {
  readonly templatesOnly: boolean;
  readonly skipGenerate: boolean;
  readonly skipInstall: boolean;
  readonly skipScaffold: boolean;
  readonly skipConfigure: boolean;
}

/**
 * Adds the shared naming positionals + common options to a yargs builder.
 *
 * @param yargs - The yargs builder to extend.
 * @returns The extended builder.
 */
function withCommonSetupOptions(yargs: Argv): Argv {
  return yargs
    .positional('firebaseProjectId', { type: 'string', describe: 'Firebase project id (omit to read from dbx.setup.json).' })
    .positional('projectName', { type: 'string', describe: 'Project name (default: firebase project id).' })
    .positional('codePrefix', { type: 'string', describe: 'camelCase code prefix (default: app).' })
    .positional('emulatorPort', { type: 'number', describe: 'Base Firebase emulator port (default: 9100).' })
    .positional('stagingProjectId', { type: 'string', describe: 'Staging firebase project id (default: <id>-staging).' })
    .option('dir', { type: 'string', default: '.', describe: 'Project root directory.' })
    .option('branch', { type: 'string', describe: 'Source branch recorded in the manifest (default: develop).' })
    .option('components-version', { type: 'string', describe: 'dbx-components version to install.' })
    .option('ci-test', { type: 'boolean', default: false, describe: 'CI-test mode (install @dereekb from the CI dist folder; skip firebase login).' })
    .option('dry-run', { type: 'boolean', default: false, describe: 'Print the file-write + shell plan without touching disk.' })
    .option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of human-readable text.' });
}

/**
 * Maps parsed args to the shared context resolver input.
 *
 * @param args - The parsed yargs arguments.
 * @returns The resolver input.
 */
function toResolveInput(args: ArgumentsCamelCase<CommonSetupArgs>): ResolveSetupContextInput {
  return {
    dir: args.dir,
    firebaseProjectId: args.firebaseProjectId,
    projectName: args.projectName,
    codePrefix: args.codePrefix,
    emulatorPort: args.emulatorPort,
    stagingProjectId: args.stagingProjectId,
    branch: args.branch,
    componentsVersion: args.componentsVersion,
    ciTest: args.ciTest,
    dryRun: args.dryRun,
    log: (message: string) => console.error(message)
  };
}

/**
 * Renders a scaffold summary for a module run.
 *
 * @param input - The summary inputs.
 * @param input.moduleId - The module id.
 * @param input.results - The per-file write results.
 * @param input.context - The resolved setup context.
 * @param input.json - Whether to emit JSON instead of text.
 * @returns The rendered summary.
 */
function formatScaffoldSummary(input: { readonly moduleId: string; readonly results: readonly ScaffoldWriteResult[]; readonly context: SetupContext; readonly json: boolean }): string {
  const { moduleId, results, context, json } = input;
  if (json) {
    return JSON.stringify({ module: moduleId, dryRun: context.dryRun, files: results.map((result) => result.destPath) }, null, 2);
  }
  const verb = context.dryRun ? 'would write' : 'wrote';
  return `setup ${moduleId}: ${verb} ${results.length} file(s) to ${context.workspaceRoot}`;
}

/**
 * Builds one per-module command.
 *
 * @param id - The module id.
 * @returns The yargs command module.
 */
function moduleCommand(id: SetupModuleId): CommandModule<object, ModuleArgs> {
  return {
    command: `${id} [firebaseProjectId] [projectName] [codePrefix] [emulatorPort] [stagingProjectId]`,
    describe: SETUP_MODULES[id].title,
    builder: (yargs: Argv): Argv<ModuleArgs> =>
      withCommonSetupOptions(yargs)
        .option('templates-only', { type: 'boolean', default: false, describe: 'Run only the deterministic scaffold phase.' })
        .option('skip-generate', { type: 'boolean', default: false, describe: 'Skip the nx/npm generate phase.' })
        .option('skip-install', { type: 'boolean', default: false, describe: 'Skip the npm install phase.' })
        .option('skip-scaffold', { type: 'boolean', default: false, describe: 'Skip the file scaffold phase.' })
        .option('skip-configure', { type: 'boolean', default: false, describe: 'Skip the configure (json-edit) phase.' }) as unknown as Argv<ModuleArgs>,
    handler: (args: ArgumentsCamelCase<ModuleArgs>): Promise<void> =>
      runCommand(async () => {
        const context = resolveSetupContext(toResolveInput(args));
        const module = SETUP_MODULES[id];
        let results: readonly ScaffoldWriteResult[];
        if (args.templatesOnly) {
          results = runModuleScaffold(module, context);
        } else {
          await runModulePhases(module, context, { skipGenerate: args.skipGenerate, skipInstall: args.skipInstall, skipScaffold: args.skipScaffold, skipConfigure: args.skipConfigure });
          results = args.skipScaffold ? [] : module.buildScaffoldPlan(context).map((entry) => ({ destPath: entry.destPath, mode: entry.mode, skipped: context.dryRun }));
        }
        return formatScaffoldSummary({ moduleId: id, results, context, json: args.json });
      })
  };
}

interface ValidateArgs extends CommonSetupArgs {
  readonly module?: SetupModuleId;
}

const validateCommand: CommandModule<object, ValidateArgs> = {
  command: 'validate [firebaseProjectId] [projectName] [codePrefix] [emulatorPort] [stagingProjectId]',
  describe: 'Validate that the expected dbx-components structure is present.',
  builder: (yargs: Argv): Argv<ValidateArgs> => withCommonSetupOptions(yargs).option('module', { choices: SCAFFOLDING_MODULE_IDS, describe: 'Validate a single module instead of all.' }) as unknown as Argv<ValidateArgs>,
  handler: (args: ArgumentsCamelCase<ValidateArgs>): Promise<void> =>
    runCommand(async () => {
      const context = resolveSetupContext(toResolveInput(args));
      const ids = args.module ? [args.module] : SCAFFOLDING_MODULE_IDS;
      const results: ModuleValidationResult[] = ids.map((id) => validateExpectedFiles({ moduleId: id, expectedFiles: moduleExpectedFiles(SETUP_MODULES[id], context), validationRoot: context.workspaceRoot }));

      // Validate installed add-ons (recorded in the manifest) by their scaffolded NEW files.
      const manifest = args.module ? undefined : readManifest(context.workspaceRoot);
      if (manifest) {
        for (const addon of manifest.addons ?? []) {
          const setupAddon = SETUP_ADDONS[addon.id as SetupAddonId];
          if (setupAddon) {
            const addonContext: AddonContext = { ...context, manifest };
            results.push(validateExpectedFiles({ moduleId: `addon:${addon.id}`, expectedFiles: addonExpectedFiles(setupAddon, addonContext), validationRoot: context.workspaceRoot }));
          }
        }
      }

      if (validationHasMissing(results)) {
        process.exitCode = 1;
      }
      return args.json ? JSON.stringify(results, null, 2) : formatValidationMarkdown(results);
    })
};

interface ManifestArgs extends CommonSetupArgs {
  readonly action: 'show' | 'write';
}

const manifestCommand: CommandModule<object, ManifestArgs> = {
  command: 'manifest <action> [firebaseProjectId] [projectName] [codePrefix] [emulatorPort] [stagingProjectId]',
  describe: 'Read (show) or derive + write (write) the dbx.setup.json manifest.',
  builder: (yargs: Argv): Argv<ManifestArgs> => withCommonSetupOptions(yargs.positional('action', { choices: ['show', 'write'] as const, demandOption: true, describe: 'show or write.' })) as unknown as Argv<ManifestArgs>,
  handler: (args: ArgumentsCamelCase<ManifestArgs>): Promise<void> =>
    runCommand(async () => {
      if (args.action === 'show') {
        const context = resolveSetupContext({ dir: args.dir, firebaseProjectId: args.firebaseProjectId });
        const manifest = readManifest(context.workspaceRoot);
        if (!manifest) {
          throw new Error(`No dbx.setup.json found in ${context.workspaceRoot}`);
        }
        return JSON.stringify(manifest, null, 2);
      }
      const context = resolveSetupContext(toResolveInput(args));
      const integrations = SETUP_MODULES.integrations;
      // The integrations module owns the manifest write; run only its scaffold (manifest entry).
      runModuleScaffold(integrations, context);
      return `setup manifest: ${context.dryRun ? 'would write' : 'wrote'} dbx.setup.json to ${context.workspaceRoot}`;
    })
};

interface AddonArgs extends CommonSetupArgs {
  readonly templatesOnly: boolean;
  readonly skipScaffold: boolean;
  readonly skipConfigure: boolean;
}

/**
 * Renders a summary of an add-on run (scaffolded files, injection statuses,
 * file edits, and any manual-wiring fallbacks).
 *
 * @param input - The summary inputs.
 * @param input.id - The add-on id.
 * @param input.context - The resolved add-on context.
 * @param input.scaffold - The scaffold write results.
 * @param input.configure - The configure result, when configure ran.
 * @param input.json - Whether to emit JSON instead of text.
 * @returns The rendered summary.
 */
function formatAddonSummary(input: { readonly id: SetupAddonId; readonly context: AddonContext; readonly scaffold: readonly ScaffoldWriteResult[]; readonly configure?: ReturnType<typeof runAddon>['configure']; readonly json: boolean }): string {
  const { id, context, scaffold, configure, json } = input;
  const injections = configure?.injections ?? [];
  const fileEdits = configure?.fileEdits ?? [];
  const manual = formatManualInjectionInstructions(injections, { relativeTo: context.workspaceRoot });

  if (json) {
    return JSON.stringify({ addon: id, dryRun: context.dryRun, files: scaffold.map((result) => result.destPath), injections: injections.map((result) => ({ file: result.filePath, marker: result.marker, status: result.status })), fileEdits }, null, 2);
  }

  const verb = context.dryRun ? 'would apply' : 'applied';
  const appliedInjections = injections.filter((result) => result.status === 'applied').length;
  const manualInjections = injections.filter((result) => result.status === 'marker-missing' || result.status === 'file-missing').length;
  const lines = [`setup addon ${id}: ${verb} ${scaffold.length} file(s), ${appliedInjections} injection(s) (${manualInjections} need manual wiring), ${fileEdits.length} config edit(s) in ${context.workspaceRoot}`];
  if (manual) {
    lines.push('', manual);
  }
  return lines.join('\n');
}

/**
 * Builds one per-add-on command (`setup addon <id>`).
 *
 * @param id - The add-on id.
 * @returns The yargs command module.
 */
function addonCommand(id: SetupAddonId): CommandModule<object, AddonArgs> {
  return {
    command: `${id} [firebaseProjectId] [projectName] [codePrefix] [emulatorPort] [stagingProjectId]`,
    describe: SETUP_ADDONS[id].title,
    builder: (yargs: Argv): Argv<AddonArgs> => withCommonSetupOptions(yargs).option('templates-only', { type: 'boolean', default: false, describe: 'Run only the deterministic NEW-file scaffold (skip configure).' }).option('skip-scaffold', { type: 'boolean', default: false, describe: 'Skip the NEW-file scaffold phase.' }).option('skip-configure', { type: 'boolean', default: false, describe: 'Skip the configure (marker-injection + json-edit) phase.' }) as unknown as Argv<AddonArgs>,
    handler: (args: ArgumentsCamelCase<AddonArgs>): Promise<void> =>
      runCommand(async () => {
        const context = resolveSetupContext(toResolveInput(args));
        const manifest = readManifest(context.workspaceRoot);
        if (!manifest) {
          throw new Error(`setup addon ${id}: no ${DBX_SETUP_MANIFEST_FILENAME} found in ${context.workspaceRoot}. Run \`setup init\` or cd into a scaffolded project first.`);
        }
        const addon = SETUP_ADDONS[id];
        assertManifestFields(manifest, addon.requiredManifestFields, `setup addon ${id}`);

        const addonContext: AddonContext = { ...context, manifest };
        const unmet = unmetAddonDependencies({ addon, context: addonContext, resolve: (depId) => SETUP_ADDONS[depId] });
        if (unmet.length > 0) {
          throw new Error(`setup addon ${id}: requires the ${unmet.join(', ')} add-on(s). Run \`dbx-components-cli setup addon ${unmet[0]}\` first.`);
        }

        const result = runAddon(addon, addonContext, { skipScaffold: args.skipScaffold, skipConfigure: args.templatesOnly || args.skipConfigure });
        if (!context.dryRun) {
          writeManifest(context.workspaceRoot, withInstalledAddon(manifest, id, context.createdAt));
        }
        return formatAddonSummary({ id, context: addonContext, scaffold: result.scaffold, configure: result.configure, json: args.json });
      })
  };
}

/**
 * The `setup addon <name>` command group.
 */
const addonGroupCommand: CommandModule = {
  command: 'addon <name>',
  describe: 'Install an add-on (oidc, mcp) into an existing project.',
  builder: (yargs: Argv): Argv => {
    let next = yargs;
    for (const id of SETUP_ADDON_IDS) {
      next = next.command(addonCommand(id));
    }
    return next.demandCommand(1, 'Specify an add-on (oidc, mcp).');
  },
  handler: () => undefined
};

interface InitArgs extends CommonSetupArgs {
  readonly manual: boolean;
  readonly templatesOnly: boolean;
  readonly skipInstall: boolean;
  readonly skipGenerate: boolean;
  readonly skipGit: boolean;
  readonly skipFirebaseInit: boolean;
  readonly skipFinal: boolean;
}

const initCommand: CommandModule<object, InitArgs> = {
  command: 'init [firebaseProjectId] [projectName] [codePrefix] [emulatorPort] [stagingProjectId]',
  describe: 'Run the full ordered setup sequence (reproduces setup-project.sh).',
  builder: (yargs: Argv): Argv<InitArgs> =>
    withCommonSetupOptions(yargs)
      .option('manual', { type: 'boolean', default: true, describe: 'Interactive firebase init prompts (use --no-manual to scaffold rules/config from templates).' })
      .option('templates-only', { type: 'boolean', default: false, describe: 'Run only the deterministic scaffold phases.' })
      .option('skip-install', { type: 'boolean', default: false, describe: 'Skip npm install phases.' })
      .option('skip-generate', { type: 'boolean', default: false, describe: 'Skip nx generate phases.' })
      .option('skip-git', { type: 'boolean', default: false, describe: 'Skip git checkpoint commits + orphan squash.' })
      .option('skip-firebase-init', { type: 'boolean', default: false, describe: 'Skip firebase init / login.' })
      .option('skip-final', { type: 'boolean', default: false, describe: 'Skip the final builds/tests + docker reset.' }) as unknown as Argv<InitArgs>,
  handler: (args: ArgumentsCamelCase<InitArgs>): Promise<void> =>
    runCommand(async () => {
      const context = resolveSetupContext(toResolveInput(args));
      const flags: SetupInitFlags = {
        manual: args.manual,
        templatesOnly: args.templatesOnly,
        skipInstall: args.skipInstall,
        skipGenerate: args.skipGenerate,
        skipGit: args.skipGit,
        skipFirebaseInit: args.skipFirebaseInit,
        skipFinal: args.skipFinal
      };
      const summary = await runSetupInit(context, flags);
      return args.json ? JSON.stringify(summary, null, 2) : summary.text;
    })
};

/**
 * The `setup` command group.
 */
export const SETUP_COMMAND: CommandModule = {
  command: 'setup <command>',
  describe: 'Scaffold + validate a dbx-components project (init, per-module, validate, manifest).',
  builder: (yargs: Argv): Argv => {
    let next = yargs.command(initCommand).command(validateCommand).command(manifestCommand).command(addonGroupCommand);
    for (const id of SETUP_MODULE_IDS) {
      next = next.command(moduleCommand(id));
    }
    return next.demandCommand(1, 'Specify a setup subcommand (init, addon, <module>, validate, manifest).');
  },
  handler: () => undefined
};

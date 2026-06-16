/**
 * Public surface of `@dereekb/dbx-components-cli`.
 *
 * Exposes the CLI runner + command modules so they can be embedded or tested
 * programmatically. The actual scanner logic lives in `@dereekb/dbx-cli` — this
 * package is the thin distributed CLI layer over it.
 */

export { runDbxComponentsCli, runDbxComponentsCliFromProcess } from './cli.js';
export { SPEC_COMMAND } from './commands/spec.command.js';
export { FIXTURE_COMMAND } from './commands/fixture.command.js';
export { VALIDATE_COMMAND } from './commands/validate.command.js';
export { LIST_COMMAND } from './commands/list.command.js';
export { SETUP_COMMAND } from './commands/setup.command.js';
export { resolvePath, runCommand, type ResolvedPath } from './lib/run.js';

// Deterministic setup engine — embeddable / testable surface.
export { deriveSetupNaming, type SetupNaming, type SetupNamingInputs } from './lib/setup/naming.js';
export { buildSetupTokenTable, type SetupToken, type SetupTokenTable } from './lib/setup/tokens.js';
export { applyTokens } from './lib/setup/substitute.js';
export { buildScaffoldPlan, applyScaffoldPlan, archiveScaffoldEntry, literalScaffoldEntry, type ScaffoldPlanEntry, type ScaffoldEntryMode, type ScaffoldWriteResult } from './lib/setup/scaffold.js';
export { openTemplateArchive, templateArchiveFromDirectory, type TemplateArchive } from './lib/setup/archive.js';
export { buildSetupManifest, readManifest, writeManifest, serializeSetupManifest, setupNamingInputsFromManifest, type DbxSetupManifest } from './lib/setup/manifest.js';
export { applyNxJsonEdits, applyFirebaseJsonEdits, applyTsconfigBaseEdits, applyApiTsconfigEdits, editJsonFile, type JsonObject } from './lib/setup/json-edit.js';
export { validateExpectedFiles, validationHasMissing, formatValidationMarkdown, type ModuleValidationResult } from './lib/setup/validate.js';
export { resolveSetupVersions, DEFAULT_SETUP_CORE_VERSIONS, type SetupCoreVersions, type ResolvedSetupVersions } from './lib/setup/versions.js';
export { resolveSetupContext, type ResolveSetupContextInput } from './lib/setup/resolve.js';
export { runSetupInit, type SetupInitFlags, type SetupInitResult } from './lib/setup/init.js';
export { type SetupContext, type SetupModule, type SetupModuleId, runModuleScaffold, moduleExpectedFiles, runModulePhases } from './lib/setup/module.js';
export { SETUP_MODULES, SETUP_MODULE_IDS, SCAFFOLDING_MODULE_IDS } from './lib/setup/modules/index.js';

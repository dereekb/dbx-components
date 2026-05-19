/**
 * Pure validation entry point for `dbx_model_test_validate_app`.
 *
 * Two passes:
 *
 *   1. **Filename drift** — walks the discovered spec catalog, emitting a
 *      violation for each non-canonical classification kind. The classifier
 *      in `model-test-shared/conventions.ts` does the heavy lifting; this
 *      layer just maps each `SpecFileKind` to the appropriate
 *      {@link ModelTestValidateAppCode}.
 *   2. **Coverage** — for every non-reserved model group enumerated on the
 *      component side, warn when there's no `<group>.crud.spec.ts` on the
 *      API side. Scenario specs are optional and not enforced here.
 *
 * The MCP tool wrapper supplies the discovered catalog and component
 * extraction; this layer never touches disk. That keeps tests fast and the
 * `dbx_app_validate` aggregator able to drive the same inputs through a
 * single call site.
 */

import { attachRemediation } from '../rule-catalog/index.js';
import { buildCanonicalFilename, type DiscoveredSpecCatalog, type DiscoveredSpecFile } from '../model-test-shared/index.js';
import type { ExtractionOutcome } from '../model-list-component/extract.js';
import { DEFAULT_SEVERITY, type ModelTestValidateAppResult, type ValidateModelTestAppOptions, type Violation, type ViolationCode } from './types.js';
import type { ViolationSeverity } from '../validate-format.js';

/**
 * Inputs to {@link validateModelTestApp}. Both sides are required because
 * the coverage pass cross-references the component model surface against
 * the API spec catalog.
 */
export interface ValidateModelTestAppInput {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly specCatalog: DiscoveredSpecCatalog;
  readonly componentExtraction: ExtractionOutcome;
}

/**
 * Runs the two-pass validation against the supplied snapshots. Pure —
 * never touches the filesystem; the wrapper layer is responsible for
 * inspection.
 *
 * @param input - Component + API snapshots and the relative paths echoed in the result.
 * @param options - Per-call overrides (currently just `strict`).
 * @returns The aggregated validation outcome.
 */
export function validateModelTestApp(input: ValidateModelTestAppInput, options: ValidateModelTestAppOptions = {}): ModelTestValidateAppResult {
  const severity: ViolationSeverity = options.strict ? 'error' : DEFAULT_SEVERITY;
  const violations: Violation[] = [];
  let specFilesChecked = 0;

  for (const group of input.specCatalog.groups) {
    for (const file of group.files) {
      specFilesChecked += 1;
      collectFileViolation({ group: group.group, file, severity, violations });
    }
  }

  const modelGroupsChecked = collectCoverageViolations({
    extraction: input.componentExtraction,
    specCatalog: input.specCatalog,
    severity,
    violations
  });

  let errorCount = 0;
  let warningCount = 0;
  for (const v of violations) {
    if (v.severity === 'error') errorCount += 1;
    else warningCount += 1;
  }

  return {
    componentDir: input.componentDir,
    apiDir: input.apiDir,
    violations,
    errorCount,
    warningCount,
    specFilesChecked,
    modelGroupsChecked
  };
}

interface CollectFileViolationInput {
  readonly group: string;
  readonly file: DiscoveredSpecFile;
  readonly severity: ViolationSeverity;
  readonly violations: Violation[];
}

function collectFileViolation(input: CollectFileViolationInput): void {
  const { group, file, severity, violations } = input;
  const c = file.classification;
  if (c.isCanonical) return;
  if (c.kind === 'non-spec') return;
  let code: ViolationCode | undefined;
  let message: string | undefined;
  if (c.kind === 'crud-misplaced' || c.kind === 'scenario-misplaced') {
    code = 'TEST_FILE_DRIFT_RENAME';
    message = `\`${c.filename}\`: ${c.driftReason ?? 'segment order does not match the convention.'} Rename to \`${c.recommendedRename}\`.`;
  } else if (c.kind === 'no-bucket') {
    code = 'TEST_FILE_MISSING_BUCKET';
    message = `\`${c.filename}\`: missing \`crud\` / \`scenario\` segment. Rename to \`${c.recommendedRename}\` (default) or to a \`crud\` variant if the tests are CRUD-flavored.`;
  } else if (c.kind === 'non-group') {
    code = 'TEST_FILE_NON_GROUP_PLACEMENT';
    message = `\`${c.filename}\`: first segment \`${c.group}\` does not match the parent folder \`${group}\`. Move into \`${c.group}/\` or rename the prefix to match the current folder.`;
  }
  if (code === undefined || message === undefined) return;
  pushViolation(violations, {
    code,
    severity,
    message,
    group,
    file: file.fileRel
  });
}

interface CollectCoverageViolationsInput {
  readonly extraction: ExtractionOutcome;
  readonly specCatalog: DiscoveredSpecCatalog;
  readonly severity: ViolationSeverity;
  readonly violations: Violation[];
}

function collectCoverageViolations(input: CollectCoverageViolationsInput): number {
  const { extraction, specCatalog, severity, violations } = input;
  const groupsWithCrudSpec = new Set<string>();
  for (const g of specCatalog.groups) {
    for (const f of g.files) {
      const c = f.classification;
      if (c.isCanonical && (c.kind === 'crud' || c.kind === 'crud-subgroup')) {
        groupsWithCrudSpec.add(g.group);
      }
    }
  }
  for (const model of extraction.models) {
    const expectedFilename = buildCanonicalFilename({ group: model.folder, bucket: 'crud', subgroups: [] });
    if (groupsWithCrudSpec.has(model.folder)) continue;
    const expectedPath = `${specCatalog.functionDirRel}/${model.folder}/${expectedFilename}`;
    pushViolation(violations, {
      code: 'MODEL_GROUP_MISSING_CRUD_SPEC',
      severity,
      message: `Model group \`${model.folder}\` (${model.modelName}) has no \`${expectedFilename}\`. Add \`${expectedPath}\` covering the CRUD function map.`,
      group: model.folder,
      file: undefined
    });
  }
  return extraction.models.length;
}

interface PushViolationInput {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly group: string;
  readonly file: string | undefined;
}

function pushViolation(buffer: Violation[], input: PushViolationInput): void {
  const filled: Violation = {
    code: input.code,
    severity: input.severity,
    message: input.message,
    group: input.group,
    file: input.file,
    remediation: attachRemediation(input.code)
  };
  buffer.push(filled);
}

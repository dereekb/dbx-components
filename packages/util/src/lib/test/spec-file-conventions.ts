/**
 * Spec-file naming conventions for API test files.
 *
 * Downstream Firebase Functions API apps keep their tests under
 * `<apiDir>/src/app/function/<group>/`, with each spec file named so that
 * "what does this test, and where do I add the next one?" can be answered
 * from the filename alone. The canonical forms are:
 *
 * - `<group>.crud.spec.ts` — non-scenario tests of the CRUD function map for the group.
 * - `<group>.crud.<sub>[.<sub>...].spec.ts` — CRUD tests focused on a sub-area
 *   (e.g. `job.crud.requirement.spec.ts`).
 * - `<group>.scenario.spec.ts` — generic multi-step scenario tests using fixture
 *   chains.
 * - `<group>.scenario.<sub>[.<sub>...].spec.ts` — focused scenario sub-bucket
 *   (e.g. `job.scenario.requirement.worker.state.spec.ts`).
 *
 * Drift forms (still parsed, but flagged with a rename suggestion):
 * - `<group>.<sub>.crud.spec.ts` — `crud` placed after a subgroup.
 *   Suggestion: `<group>.crud.<sub>.spec.ts`.
 * - `<group>.<sub>.scenario.spec.ts` — `scenario` placed after a subgroup
 *   (e.g. `worker.payroll.scenario.spec.ts`, `school.job.publish.scenario.spec.ts`).
 *   Suggestion: `<group>.scenario.<sub>.spec.ts`.
 * - `<group>.<rest>.spec.ts` — no `crud` / `scenario` segment at all
 *   (e.g. `worker.system.spec.ts`). Defaults to a scenario rename suggestion
 *   because the missing bucket is more often scenario-like.
 *
 * This module is pure: classification and canonical-path rendering live
 * here, with no disk I/O. It's consumed by `@dereekb/dbx-components-mcp`
 * (the `dbx_model_test_*` tool cluster) and by
 * `@dereekb/firebase/eslint` (the `require-canonical-api-spec-filename`
 * and `require-api-crud-spec-for-group` rules).
 */

/**
 * The naming buckets recognised by the classifier. `non-spec` is emitted when
 * the input does not end in `.spec.ts`; `non-group` when the first filename
 * segment doesn't match the parent folder name (the file belongs to a different
 * model group or to no group at all).
 */
export type SpecFileKind = 'crud' | 'crud-subgroup' | 'scenario' | 'scenario-subgroup' | 'crud-misplaced' | 'scenario-misplaced' | 'no-bucket' | 'non-spec' | 'non-group';

/**
 * Whether a given kind is on-convention. Drift kinds (`-misplaced`,
 * `no-bucket`) are still parseable but earn a warning + rename suggestion.
 */
export const CANONICAL_KINDS: readonly SpecFileKind[] = ['crud', 'crud-subgroup', 'scenario', 'scenario-subgroup'];

/**
 * One classified spec file. Drift entries carry a {@link recommendedRename}
 * suggesting the canonical filename; canonical entries leave it undefined.
 */
export interface SpecFileClassification {
  readonly filename: string;
  readonly group: string;
  readonly kind: SpecFileKind;
  /**
   * Segments between the group name and the `crud` / `scenario` marker for
   * `crud-subgroup` / `scenario-subgroup` kinds (e.g. `['requirement','worker']`
   * for `job.scenario.requirement.worker.spec.ts`). Empty for `crud` /
   * `scenario` and for non-group kinds.
   */
  readonly subgroups: readonly string[];
  /**
   * `true` when the kind is one of {@link CANONICAL_KINDS}.
   */
  readonly isCanonical: boolean;
  /**
   * Suggested canonical filename when the input is drift. `undefined` for
   * canonical entries and for {@link `non-spec`} / {@link `non-group`}.
   */
  readonly recommendedRename?: string;
  /**
   * Human-readable reason emitted with drift kinds; `undefined` for canonical
   * entries. Used by the formatter so each warning line explains itself.
   */
  readonly driftReason?: string;
}

const SPEC_SUFFIX = '.spec.ts';

/**
 * Classifies a spec filename against the conventions for the given parent
 * folder. Pure function — never touches the filesystem.
 *
 * @param config - Inputs.
 * @param config.filename - Bare filename including the `.spec.ts` suffix
 *   (e.g. `job.scenario.requirement.spec.ts`).
 * @param config.parentFolderName - Name of the directory containing the file
 *   (e.g. `job`). Used to detect cross-group misplacement.
 * @returns The classification.
 */
export function classifySpecFile(config: { readonly filename: string; readonly parentFolderName: string }): SpecFileClassification {
  const { filename, parentFolderName } = config;
  let result: SpecFileClassification;
  if (!filename.endsWith(SPEC_SUFFIX)) {
    result = { filename, group: '', kind: 'non-spec', subgroups: [], isCanonical: false };
  } else {
    const stem = filename.slice(0, -SPEC_SUFFIX.length);
    const parts = stem.split('.');
    const group = parts[0] ?? '';
    if (group !== parentFolderName) {
      result = { filename, group, kind: 'non-group', subgroups: [], isCanonical: false };
    } else {
      const rest = parts.slice(1);
      result = classifyRemainingSegments({ filename, group, rest });
    }
  }
  return result;
}

function classifyRemainingSegments(config: { readonly filename: string; readonly group: string; readonly rest: readonly string[] }): SpecFileClassification {
  const { filename, group, rest } = config;
  let result: SpecFileClassification;
  const crudIdx = rest.indexOf('crud');
  const scenarioIdx = rest.indexOf('scenario');
  if (crudIdx === 0) {
    if (rest.length === 1) {
      result = { filename, group, kind: 'crud', subgroups: [], isCanonical: true };
    } else {
      result = { filename, group, kind: 'crud-subgroup', subgroups: rest.slice(1), isCanonical: true };
    }
  } else if (scenarioIdx === 0) {
    if (rest.length === 1) {
      result = { filename, group, kind: 'scenario', subgroups: [], isCanonical: true };
    } else {
      result = { filename, group, kind: 'scenario-subgroup', subgroups: rest.slice(1), isCanonical: true };
    }
  } else if (crudIdx > 0) {
    const subgroups = rest.filter((_, i) => i !== crudIdx);
    const recommendedRename = buildCanonicalFilename({ group, bucket: 'crud', subgroups });
    result = { filename, group, kind: 'crud-misplaced', subgroups, isCanonical: false, recommendedRename, driftReason: '`crud` segment is not directly after the group name.' };
  } else if (scenarioIdx > 0) {
    const subgroups = rest.filter((_, i) => i !== scenarioIdx);
    const recommendedRename = buildCanonicalFilename({ group, bucket: 'scenario', subgroups });
    result = { filename, group, kind: 'scenario-misplaced', subgroups, isCanonical: false, recommendedRename, driftReason: '`scenario` segment is not directly after the group name.' };
  } else if (rest.length === 0) {
    const recommendedRename = buildCanonicalFilename({ group, bucket: 'scenario', subgroups: [] });
    result = { filename, group, kind: 'no-bucket', subgroups: [], isCanonical: false, recommendedRename, driftReason: 'Missing `crud` or `scenario` segment.' };
  } else {
    const recommendedRename = buildCanonicalFilename({ group, bucket: 'scenario', subgroups: rest });
    result = { filename, group, kind: 'no-bucket', subgroups: rest, isCanonical: false, recommendedRename, driftReason: 'Missing `crud` or `scenario` segment — defaulting suggestion to `scenario`.' };
  }
  return result;
}

/**
 * Renders a canonical spec filename for the given group + bucket + subgroup
 * chain. Pure data — used both by drift remediation and by the
 * `recommendSpecPath()` helper below.
 *
 * @param config - Inputs.
 * @param config.group - The model-group name (e.g. `job`).
 * @param config.bucket - `crud` or `scenario`.
 * @param config.subgroups - Optional ordered subgroup segments
 *   (e.g. `['requirement','worker']`).
 * @returns The canonical filename (e.g. `job.scenario.requirement.worker.spec.ts`).
 */
export function buildCanonicalFilename(config: { readonly group: string; readonly bucket: 'crud' | 'scenario'; readonly subgroups: readonly string[] }): string {
  const { group, bucket, subgroups } = config;
  const tail = subgroups.length === 0 ? '' : `.${subgroups.join('.')}`;
  return `${group}.${bucket}${tail}.spec.ts`;
}

/**
 * Renders the canonical relative path for a spec file under a given API app.
 * The shape mirrors the layout used throughout the workspace:
 * `<apiDir>/src/app/function/<group>/<filename>`.
 *
 * @param config - Inputs.
 * @param config.apiDir - The relative API-app directory
 *   (e.g. `apps/hellosubs-api`).
 * @param config.group - The model-group name.
 * @param config.bucket - `crud` or `scenario`.
 * @param config.subgroups - Optional subgroup chain.
 * @returns The canonical relative spec-file path.
 */
export function recommendSpecPath(config: { readonly apiDir: string; readonly group: string; readonly bucket: 'crud' | 'scenario'; readonly subgroups: readonly string[] }): string {
  const filename = buildCanonicalFilename({ group: config.group, bucket: config.bucket, subgroups: config.subgroups });
  return `${config.apiDir}/src/app/function/${config.group}/${filename}`;
}

/**
 * One recommendation slot rendered by the list-app tool's "where to add a new
 * test" section. `subgroups` is left empty for the base buckets; callers
 * substitute their own subgroup chain when scaffolding a focused file.
 */
export interface SpecBucketRecommendation {
  readonly bucket: 'crud' | 'scenario';
  readonly label: string;
  readonly canonicalPath: string;
  readonly summary: string;
}

/**
 * Returns the two canonical buckets for a given model group, with rendered
 * paths and one-line summaries. Used by the list-app formatter.
 *
 * @param config - Inputs.
 * @param config.apiDir - Relative API-app directory.
 * @param config.group - Model-group name.
 * @returns The crud + scenario recommendations.
 */
export function recommendBucketsForGroup(config: { readonly apiDir: string; readonly group: string }): readonly SpecBucketRecommendation[] {
  const crudPath = recommendSpecPath({ apiDir: config.apiDir, group: config.group, bucket: 'crud', subgroups: [] });
  const scenarioPath = recommendSpecPath({ apiDir: config.apiDir, group: config.group, bucket: 'scenario', subgroups: [] });
  return [
    {
      bucket: 'crud',
      label: 'CRUD',
      canonicalPath: crudPath,
      summary: 'Non-scenario tests of the CRUD function map — create/read/update/delete + permission/error paths. Add focused buckets as `' + config.group + '.crud.<sub>.spec.ts`.'
    },
    {
      bucket: 'scenario',
      label: 'Scenario',
      canonicalPath: scenarioPath,
      summary: 'Multi-step scenarios using fixture chains (mirrors real workflows). Add focused buckets as `' + config.group + '.scenario.<sub>.spec.ts` (chain subgroups freely, e.g. `.scenario.requirement.worker.spec.ts`).'
    }
  ];
}

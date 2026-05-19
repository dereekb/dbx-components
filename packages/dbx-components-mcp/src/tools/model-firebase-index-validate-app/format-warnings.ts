/**
 * Maps the firebase-index build warnings (extract + analyze) onto the
 * structured {@link ModelFirebaseIndexValidateAppViolation} shape used by
 * the MCP tool. One entry per warning kind so the catalog code stays
 * authoritative.
 *
 * The narrative message is preserved verbatim from the old inline
 * `formatBuildWarning` switch so existing CI logs read identically; the
 * canonical fix / template / see-also block is auto-attached by
 * {@link buildFirebaseIndexValidateAppViolation} via `attachRemediation`.
 */

import { ModelFirebaseIndexValidateAppCode } from './codes.js';
import { attachRemediation } from '../rule-catalog/index.js';
import type { ModelFirebaseIndexBuildWarning } from '@dereekb/dbx-cli/firestore-indexes';
import type { ModelFirebaseIndexValidateAppViolation, ModelFirebaseIndexValidateAppViolationCode } from './types.js';
import type { ViolationSeverity } from '../validate-format.js';

interface MappedBuildWarning {
  readonly code: ModelFirebaseIndexValidateAppViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
  readonly factory: string | undefined;
}

/**
 * Translates one {@link ModelFirebaseIndexBuildWarning} into the shape
 * the validator pushes as a violation.
 *
 * @param warning - The union variant emitted by the extractor or analyzer.
 * @returns The catalog code, severity, message, and location metadata.
 */
export function mapModelFirebaseIndexBuildWarning(warning: ModelFirebaseIndexBuildWarning): MappedBuildWarning {
  if (warning.stage === 'extract') {
    return mapExtractWarning(warning.warning);
  }
  return mapAnalyzeWarning(warning.warning);
}

function mapExtractWarning(w: Extract<ModelFirebaseIndexBuildWarning, { readonly stage: 'extract' }>['warning']): MappedBuildWarning {
  const severity: ViolationSeverity = w.severity === 'error' ? 'error' : 'warning';
  let result: MappedBuildWarning;
  switch (w.kind) {
    case 'missing-name':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_MISSING_NAME,
        severity,
        message: `(anonymous) tagged export has no resolvable name`,
        file: w.filePath,
        line: w.line,
        factory: undefined
      };
      break;
    case 'missing-model-tag':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_MISSING_MODEL_TAG,
        severity,
        message: `${w.name} missing required @dbxModelFirebaseIndexModel tag`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unresolved-model':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNRESOLVED_MODEL,
        severity,
        message: `${w.name} could not resolve model "${w.model}" to a Firestore identity`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unsupported-scope':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNSUPPORTED_SCOPE,
        severity,
        message: `${w.name} unsupported @dbxModelFirebaseIndexScope value "${w.scope}"`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'duplicate-slug':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_DUPLICATE_SLUG,
        severity,
        message: `${w.name} duplicate slug "${w.slug}" — already used by ${w.previousName}`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unknown-helper':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNKNOWN_HELPER,
        severity,
        message: `${w.name} unknown constraint helper "${w.helper}"`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unresolved-field':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNRESOLVED_FIELD,
        severity,
        message: `${w.name} could not resolve field-path argument to "${w.callee}"`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'missing-paths':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_MISSING_PATHS,
        severity,
        message: `${w.name} has conditional constraints on [${w.conditionalFields.join(', ')}] but no \`@dbxModelFirebaseIndexPath\` declarations — add one path tag per call pattern (e.g. \`@dbxModelFirebaseIndexPath ${w.conditionalFields.join(', ')}\`)`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unknown-path-field':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNKNOWN_PATH_FIELD,
        severity,
        message: `${w.name} \`@dbxModelFirebaseIndexPath\` references field "${w.field}" which no where/orderBy/helper call in the body produces`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unannotated-query-helper':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER,
        severity,
        message: `${w.name} calls ${w.callee} (${w.calleeFilePath}:${w.calleeLine}) which returns FirestoreQueryConstraint(s) but is not tagged with @dbxModelFirebaseIndex — tag the callee or mark it @dbxModelFirebaseIndexSkip if it should be excluded.`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'transitive-cycle':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_TRANSITIVE_CYCLE,
        severity,
        message: `${w.name} transitive call to ${w.callee} would re-enter a factory already on the resolution stack — skipped to avoid infinite recursion`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'unresolvable-transitive-callee':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNRESOLVABLE_TRANSITIVE_CALLEE,
        severity,
        message: `${w.name} could not locate the source for transitive callee ${w.callee} (likely a cross-package .d.ts import) — splice skipped`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'complex-query-body':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY,
        severity,
        message: `${w.name} tagged query body contains a \`${w.branchKind}\` construct. Tagged @dbxModelFirebaseIndex functions must be branch-free (no if/else, switch, ternary, or loops) so each maps to exactly one Firestore index.`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'non-delegating-dispatcher':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_NON_DELEGATING_DISPATCHER,
        severity,
        message: `${w.name} is tagged \`@dbxModelFirebaseIndexDispatcher\` but calls \`${w.callee}\` directly. Dispatchers must only delegate to other tagged query functions and may not call where/orderBy/helpers themselves.`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
    case 'excluded-factory':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_EXCLUDED,
        severity,
        message: `${w.name} is tagged \`@dbxModelFirebaseIndexExclude\` — constraints are parsed but the analyzer is suppressing composite + fieldOverride emission. Remove the tag to restore index generation, or switch to \`@dbxModelFirebaseIndexSkip\` to silence the audit warning.`,
        file: w.filePath,
        line: w.line,
        factory: w.name
      };
      break;
  }
  return result;
}

function mapAnalyzeWarning(w: Extract<ModelFirebaseIndexBuildWarning, { readonly stage: 'analyze' }>['warning']): MappedBuildWarning {
  let result: MappedBuildWarning;
  switch (w.kind) {
    case 'multiple-range-fields':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_MULTIPLE_RANGE_FIELDS,
        severity: 'warning',
        message: `${w.factoryName} multiple range-field constraints on [${w.fields.join(', ')}] — Firestore allows only one range field per query`,
        file: undefined,
        line: undefined,
        factory: w.factoryName
      };
      break;
    case 'orderby-conflict':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_ORDERBY_CONFLICT,
        severity: 'warning',
        message: `${w.factoryName} field "${w.field}" has conflicting orderBy directions [${w.directions.join(', ')}]`,
        file: undefined,
        line: undefined,
        factory: w.factoryName
      };
      break;
    case 'unsupported-array-contains-any':
      result = {
        code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNSUPPORTED_ARRAY_CONTAINS_ANY,
        severity: 'warning',
        message: `${w.factoryName} field "${w.field}" uses array-contains-any — index support is partial`,
        file: undefined,
        line: undefined,
        factory: w.factoryName
      };
      break;
  }
  return result;
}

/**
 * Materialises a {@link ModelFirebaseIndexValidateAppViolation} from a
 * mapped warning, attaching the catalog-driven remediation hint.
 *
 * @param mapped - The warning translated by {@link mapModelFirebaseIndexBuildWarning}
 * @returns A violation ready to push onto the report buffer.
 */
export function buildFirebaseIndexValidateAppViolation(mapped: MappedBuildWarning): ModelFirebaseIndexValidateAppViolation {
  return {
    code: mapped.code,
    severity: mapped.severity,
    message: mapped.message,
    file: mapped.file,
    line: mapped.line,
    factory: mapped.factory,
    remediation: attachRemediation(mapped.code)
  };
}

/**
 * The three-way server-only reconciliation behind `dbx_model_server_only_validate_app`.
 *
 * Pure over prepared inputs — the tool wrapper owns the disk I/O — so the reconciliation itself is
 * directly unit-testable without a workspace on disk.
 */

import { ModelServerOnlyValidateAppCode, attachRemediation } from '@dereekb/dbx-cli/validate';
import { firestoreRulesAccessForCollection, type FirestoreRulesScan } from '@dereekb/dbx-cli/firestore-rules';
import type { ExtractedModelServiceFlag } from './extract-service-flags.js';
import type { ModelServerOnlyReconciliation, ModelServerOnlyValidateAppReport, ModelServerOnlyValidateAppViolation, ModelServerOnlyValidateAppViolationCode } from './types.js';

// MARK: Inputs
/**
 * One model interface found in the scanned sources, reduced to the two tags the reconciliation reads.
 */
export interface ServerOnlyInterfaceFact {
  readonly name: string;
  /**
   * True when the interface carries `@dbxModelServerOnly`.
   */
  readonly serverOnly: boolean;
  /**
   * True when the interface carries `@dbxModel` — without it, the extractor never assembles a
   * manifest entry, so a `@dbxModelServerOnly` tag on it is inert.
   */
  readonly hasModelTag: boolean;
  /**
   * Workspace-relative source file the interface is declared in.
   */
  readonly file: string;
}

/**
 * One resolved `firestoreModelIdentity(...)` declaration.
 */
export interface ServerOnlyIdentityFact {
  readonly modelType: string;
  readonly collection: string;
}

/**
 * Prepared inputs for {@link validateModelServerOnly}.
 */
export interface ValidateModelServerOnlyInput {
  readonly componentDir: string;
  readonly serviceFile: string;
  readonly rulesFile: string;
  readonly modelDirs: readonly string[];
  /**
   * Present only when the caller supplied a generated model manifest to cross-check.
   */
  readonly manifestFile?: string;
  /**
   * Model types present in the generated CLI model manifest. Only consulted when
   * {@link manifestFile} is set.
   */
  readonly manifestModelTypes?: readonly string[];
  readonly services: readonly ExtractedModelServiceFlag[];
  readonly interfaces: readonly ServerOnlyInterfaceFact[];
  readonly identities: readonly ServerOnlyIdentityFact[];
  readonly rulesScan: FirestoreRulesScan;
}

// MARK: Validate
/**
 * Reconciles the `@dbxModelServerOnly` interface tag, the `serverOnly: true` runtime service flag,
 * and the rules-derived verdict for every registered model service, emitting one violation per
 * disagreement.
 *
 * @param input - The prepared per-leg facts.
 * @returns The report both formatters render.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function validateModelServerOnly(input: ValidateModelServerOnlyInput): ModelServerOnlyValidateAppReport {
  const interfaceByName = new Map(input.interfaces.map((x) => [x.name, x]));
  const collectionByModelType = new Map(input.identities.map((x) => [x.modelType, x.collection]));
  const manifestModelTypes = input.manifestModelTypes == null ? undefined : new Set(input.manifestModelTypes);

  const reconciliations: ModelServerOnlyReconciliation[] = [];
  const violations: ModelServerOnlyValidateAppViolation[] = [];

  for (const service of input.services) {
    const iface = service.modelName == null ? undefined : interfaceByName.get(baseTypeName(service.modelName));
    const collection = collectionByModelType.get(service.modelType);
    const rulesEntry = collection == null ? undefined : firestoreRulesAccessForCollection(input.rulesScan, collection);
    const reconciliation: ModelServerOnlyReconciliation = {
      modelType: service.modelType,
      modelName: service.modelName,
      collection,
      tag: iface == null ? undefined : iface.serverOnly,
      flag: service.serverOnly,
      rules: rulesEntry?.serverOnly,
      rulesGet: rulesEntry?.get,
      rulesList: rulesEntry?.list,
      agrees: legsAgree({ tag: iface?.serverOnly, flag: service.serverOnly, rules: rulesEntry?.serverOnly })
    };

    reconciliations.push(reconciliation);
    appendServiceViolations({ reconciliation, service, iface, manifestModelTypes, manifestFile: input.manifestFile, violations });
  }

  // a `@dbxModelServerOnly` tag on an interface that is not `@dbxModel`-tagged never reaches the
  // manifest, so the CLI's local refusal silently never fires for it — reported independently of the
  // service loop because the interface may not be reachable from any registered service at all
  for (const iface of input.interfaces) {
    if (iface.serverOnly && !iface.hasModelTag) {
      violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_TAG_WITHOUT_MODEL_TAG, severity: 'warning', modelType: undefined, file: iface.file, message: `Interface \`${iface.name}\` carries \`@dbxModelServerOnly\` but no \`@dbxModel\` tag, so the model extractor skips it and \`serverOnly\` never lands on the generated model manifest.` }));
    }
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;

  return {
    componentDir: input.componentDir,
    serviceFile: input.serviceFile,
    rulesFile: input.rulesFile,
    modelDirs: input.modelDirs,
    manifestFile: input.manifestFile,
    failed: errorCount > 0,
    errorCount,
    warningCount: violations.length - errorCount,
    reconciliations,
    violations
  };
}

interface AppendServiceViolationsInput {
  readonly reconciliation: ModelServerOnlyReconciliation;
  readonly service: ExtractedModelServiceFlag;
  readonly iface: ServerOnlyInterfaceFact | undefined;
  readonly manifestModelTypes: ReadonlySet<string> | undefined;
  readonly manifestFile: string | undefined;
  readonly violations: ModelServerOnlyValidateAppViolation[];
}

/**
 * Appends every violation one model's reconciliation produces.
 *
 * @param input - The reconciliation, its source facts, the optional manifest cross-check, and the sink.
 */
function appendServiceViolations(input: AppendServiceViolationsInput): void {
  const { reconciliation, service, iface, manifestModelTypes, manifestFile, violations } = input;
  const { modelType, collection, tag, flag, rules } = reconciliation;
  const declared = tag === true || flag;

  if (collection == null) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_UNRESOLVED_IDENTITY, severity: 'warning', modelType, file: service.exportName, message: `No \`firestoreModelIdentity(...)\` for model type \`${modelType}\` was found in the scanned dirs, so its collection name — and therefore the rules leg of the reconciliation — could not be resolved.` }));
  } else if (rules === true && !flag) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG, severity: 'error', modelType, file: service.exportName, message: `\`${collection}\` has no client read grant in the rules (get=${reconciliation.rulesGet}, list=${reconciliation.rulesList}) but \`${service.exportName}\` does not set \`serverOnly: true\`, so the model API will hand a client a document the rules would refuse.` }));
  } else if (rules === false && declared) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_RULES_ALLOW_READ, severity: 'error', modelType, file: service.exportName, message: `\`${modelType}\` declares server-only (${describeDeclarations(tag, flag)}) but \`${collection}\` IS client-readable in the rules (get=${reconciliation.rulesGet}, list=${reconciliation.rulesList}).` }));
  }

  if (rules === true && iface != null && !iface.serverOnly) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_MISSING_TAG, severity: 'warning', modelType, file: iface.file, message: `\`${collection}\` has no client read grant in the rules but interface \`${iface.name}\` has no \`@dbxModelServerOnly\` tag, so the CLI cannot refuse the read locally.` }));
  }

  if (iface == null && flag) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_NO_INTERFACE, severity: 'warning', modelType, file: service.exportName, message: `\`${modelType}\` sets \`serverOnly: true\` but its data type \`${service.modelName ?? '(unknown)'}\` resolves to no interface in the scanned dirs, so there is nothing to carry \`@dbxModelServerOnly\`.` }));
  } else if (iface != null && tag !== flag) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH, severity: 'error', modelType, file: iface.file, message: `\`${modelType}\`: interface \`${iface.name}\` ${tag === true ? 'carries' : 'does NOT carry'} \`@dbxModelServerOnly\` while \`${service.exportName}\` ${flag ? 'DOES' : 'does not'} set \`serverOnly: true\`.` }));
  }

  if (manifestModelTypes != null && declared && !manifestModelTypes.has(modelType)) {
    violations.push(buildViolation({ code: ModelServerOnlyValidateAppCode.MODEL_SERVER_ONLY_NOT_IN_MANIFEST, severity: 'warning', modelType, file: manifestFile, message: `\`${modelType}\` is server-only but has no entry in the generated model manifest, so the CLI's local pre-transport refusal cannot fire for it — the read costs a round-trip to an API that refuses it.` }));
  }
}

/**
 * Reports whether every RESOLVABLE leg says the same thing. An unresolvable leg (`undefined`) never
 * counts as disagreement — the report says so separately, and treating an absence as a mismatch
 * would bury the real ones.
 *
 * @param input - The three legs.
 * @param input.tag - The interface-tag leg.
 * @param input.flag - The runtime-flag leg.
 * @param input.rules - The rules-derived leg.
 * @returns `true` when the resolvable legs agree.
 */
function legsAgree(input: { readonly tag: boolean | undefined; readonly flag: boolean; readonly rules: boolean | undefined }): boolean {
  const present = [input.tag, input.flag, input.rules].filter((x): x is boolean => x !== undefined);
  return present.every((x) => x === present[0]);
}

function describeDeclarations(tag: boolean | undefined, flag: boolean): string {
  const parts: string[] = [];

  if (tag === true) parts.push('`@dbxModelServerOnly`');
  if (flag) parts.push('`serverOnly: true`');

  return parts.join(' + ');
}

/**
 * Strips the generic argument list off a type reference so `PagedItemPageData<NotificationItem>`
 * joins against a declaration named `PagedItemPageData`.
 *
 * @param typeName - The type-argument text read off the service factory.
 * @returns The bare type name.
 */
function baseTypeName(typeName: string): string {
  const open = typeName.indexOf('<');
  return (open >= 0 ? typeName.slice(0, open) : typeName).trim();
}

interface BuildViolationInput {
  readonly code: ModelServerOnlyValidateAppViolationCode;
  readonly severity: 'error' | 'warning';
  readonly modelType: string | undefined;
  readonly file: string | undefined;
  readonly message: string;
}

function buildViolation(input: BuildViolationInput): ModelServerOnlyValidateAppViolation {
  const remediation = attachRemediation(input.code);
  return {
    severity: input.severity,
    code: input.code,
    message: input.message,
    modelType: input.modelType,
    file: input.file,
    ...(remediation ? { remediation } : {})
  };
}

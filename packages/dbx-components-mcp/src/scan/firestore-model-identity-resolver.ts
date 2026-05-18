/**
 * Build-time resolver from a TS type name (`JobLocationWeek`) to the
 * model's Firestore short collection name (`'jlw'`) and nested flag.
 *
 * The model-firebase-index extractor needs to map the
 * `@dbxModelFirebaseIndexModel <TypeName>` tag value onto the
 * `collectionPrefix` Firestore uses for the model — that's what becomes
 * the `collectionGroup` field in `firestore.indexes.json`. The resolver
 * builds a per-project map by walking the supplied ts-morph project for
 * `firestoreModelIdentity(...)` calls, then exposes lookup-by-type-name
 * (preferred), lookup-by-modelType (the first-string-arg), and
 * lookup-by-identity-const (e.g. `jobLocationWeekIdentity`).
 *
 * For runtime use (the `dbx_model_firebase_index_*` MCP tools) the
 * upstream `FIREBASE_MODELS` registry + downstream catalog provides the
 * same data — see {@link buildIdentityResolverFromRegistries} below.
 */

import { Node, SyntaxKind, type CallExpression, type Project } from 'ts-morph';

// MARK: Resolved record
/**
 * Resolution result for one model. `collection` is the short collection
 * prefix used by Firestore (and the `collectionGroup` field in
 * `firestore.indexes.json`). `isNested` is `true` when the identity
 * declares a parent — these models default to `COLLECTION_GROUP` scope.
 */
export interface ResolvedFirestoreModelIdentity {
  readonly modelType: string;
  readonly collection: string;
  readonly isNested: boolean;
  readonly identityConstName: string;
}

// MARK: Resolver shape
/**
 * Build-time identity resolver. Methods accept either the TS type name
 * (`'JobLocationWeek'`), the modelType string (`'jobLocationWeek'`), or
 * the identity-const name (`'jobLocationWeekIdentity'`) — extractors
 * commonly have access to whichever surface lines up with how the tagged
 * factory was written.
 */
export interface FirestoreModelIdentityResolver {
  /**
   * Lookup by the TS type / interface name (e.g. `JobLocationWeek`). The
   * resolver tries the literal name, then the camelCase form, then the
   * derived `<lowerCamelCase>Identity` const name.
   */
  readonly lookupByTypeName: (typeName: string) => ResolvedFirestoreModelIdentity | undefined;
  /**
   * Lookup by the first-arg `modelType` string passed to
   * `firestoreModelIdentity(...)` — exact match.
   */
  readonly lookupByModelType: (modelType: string) => ResolvedFirestoreModelIdentity | undefined;
  /**
   * Lookup by the identity const name (e.g. `jobLocationWeekIdentity`) —
   * exact match.
   */
  readonly lookupByIdentityConst: (identityConstName: string) => ResolvedFirestoreModelIdentity | undefined;
  /**
   * Every resolved record, useful for diagnostics.
   */
  readonly all: () => readonly ResolvedFirestoreModelIdentity[];
}

// MARK: Build-time scan
/**
 * Walks the supplied ts-morph project looking for
 * `<name>Identity = firestoreModelIdentity(...)` declarations and assembles
 * a {@link FirestoreModelIdentityResolver}.
 *
 * Identifies three call shapes:
 *   1. `firestoreModelIdentity('modelType', 'prefix')` — root identity.
 *   2. `firestoreModelIdentity(parentIdentity, 'modelType', 'prefix')` — nested identity.
 *   3. `firestoreModelIdentity('modelType')` — root identity with prefix-defaulted-to-modelType (rare; collection equals modelType).
 *
 * Calls that don't match any of these shapes are skipped silently — the
 * extractor only consumes successful matches.
 *
 * @param project - The ts-morph project whose source files to scan.
 * @returns The resolver.
 */
export function buildIdentityResolverFromProject(project: Project): FirestoreModelIdentityResolver {
  const records: ResolvedFirestoreModelIdentity[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const statement of sourceFile.getVariableStatements()) {
      for (const declaration of statement.getDeclarations()) {
        const initializer = declaration.getInitializer();
        if (initializer === undefined || !Node.isCallExpression(initializer)) {
          continue;
        }
        const parsed = parseFirestoreModelIdentityCall(initializer);
        if (parsed === undefined) {
          continue;
        }
        records.push({
          modelType: parsed.modelType,
          collection: parsed.collection,
          isNested: parsed.isNested,
          identityConstName: declaration.getName()
        });
      }
    }
  }
  return buildResolverFromRecords(records);
}

/**
 * Builds a resolver from a pre-resolved list of records — used when the
 * MCP tool runtime has access to {@link FIREBASE_MODELS} + the downstream
 * catalog and doesn't need to rescan source files.
 *
 * @param records - The resolved identity records.
 * @returns The resolver.
 */
export function buildIdentityResolverFromRecords(records: readonly ResolvedFirestoreModelIdentity[]): FirestoreModelIdentityResolver {
  return buildResolverFromRecords(records);
}

// MARK: Internals
interface ParsedFirestoreModelIdentityCall {
  readonly modelType: string;
  readonly collection: string;
  readonly isNested: boolean;
}

function parseFirestoreModelIdentityCall(call: CallExpression): ParsedFirestoreModelIdentityCall | undefined {
  const expression = call.getExpression();
  let calleeName: string | undefined;
  if (Node.isIdentifier(expression)) {
    calleeName = expression.getText();
  } else if (Node.isPropertyAccessExpression(expression)) {
    calleeName = expression.getName();
  }
  if (calleeName !== 'firestoreModelIdentity') {
    return undefined;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return undefined;
  }

  // Two- or three-arg variants; first arg is either string literal
  // (root) or identifier reference to parent identity (nested).
  const firstArg = args[0];
  let isNested = false;
  let stringArgsStart = 0;
  if (firstArg.getKind() === SyntaxKind.Identifier || firstArg.getKind() === SyntaxKind.PropertyAccessExpression) {
    isNested = true;
    stringArgsStart = 1;
  } else if (firstArg.getKind() !== SyntaxKind.StringLiteral && firstArg.getKind() !== SyntaxKind.NoSubstitutionTemplateLiteral) {
    return undefined;
  }

  const stringArgs: string[] = [];
  let invalidArg = false;
  for (let i = stringArgsStart; i < args.length; i += 1) {
    const arg = args[i];
    if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
      stringArgs.push(arg.getLiteralText());
    } else {
      invalidArg = true;
      break;
    }
  }

  let result: ParsedFirestoreModelIdentityCall | undefined;
  if (!invalidArg && stringArgs.length > 0) {
    const modelType = stringArgs[0];
    const collection = stringArgs.length >= 2 ? stringArgs[1] : modelType;
    result = { modelType, collection, isNested };
  }
  return result;
}

function buildResolverFromRecords(records: readonly ResolvedFirestoreModelIdentity[]): FirestoreModelIdentityResolver {
  const byModelType = new Map<string, ResolvedFirestoreModelIdentity>();
  const byIdentityConst = new Map<string, ResolvedFirestoreModelIdentity>();
  for (const record of records) {
    if (!byModelType.has(record.modelType)) {
      byModelType.set(record.modelType, record);
    }
    if (!byIdentityConst.has(record.identityConstName)) {
      byIdentityConst.set(record.identityConstName, record);
    }
  }

  function lookupByTypeName(typeName: string): ResolvedFirestoreModelIdentity | undefined {
    const camel = toCamelCase(typeName);
    let result = byModelType.get(camel);
    result ??= byIdentityConst.get(`${camel}Identity`);
    if (result === undefined) {
      // Fallback: scan all records for a case-insensitive modelType match.
      const lower = camel.toLowerCase();
      result = records.find((r) => r.modelType.toLowerCase() === lower);
    }
    return result;
  }

  return {
    lookupByTypeName,
    lookupByModelType: (modelType: string) => byModelType.get(modelType),
    lookupByIdentityConst: (identityConstName: string) => byIdentityConst.get(identityConstName),
    all: () => records
  };
}

/**
 * Converts `JobLocationWeek` → `jobLocationWeek`. Pass-through when the
 * input is already camelCase.
 *
 * @param typeName - The TypeScript type name.
 * @returns The lowerCamelCase identifier.
 */
export function toCamelCase(typeName: string): string {
  if (typeName.length === 0) {
    return typeName;
  }
  const firstChar = typeName.charAt(0);
  let result: string;
  if (firstChar >= 'A' && firstChar <= 'Z') {
    result = firstChar.toLowerCase() + typeName.slice(1);
  } else {
    result = typeName;
  }
  return result;
}

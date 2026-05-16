/**
 * Per-file model assembly. Combines the per-file outputs of
 * {@link findIdentities}, {@link findInterfaces}, {@link findConverters},
 * {@link findEnums}, {@link findModelGroups}, and
 * {@link findCollectionFactoryCalls} into the {@link FirebaseModel} +
 * {@link FirebaseModelGroup} entries the registry exposes.
 *
 * Mirrors the per-file body of `extractFromFile` in
 * `scripts/extract-firebase-models.mjs`.
 */

import type { FirebaseField, FirebaseModel, FirebaseModelGroup, FirebaseSubObject } from '../../registry/firebase-models.js';
import type { FirestoreCollectionKind } from '../../tools/model-validate/types.js';
import { collectInheritedProps } from './collect-inherited.js';
import type { ExtractedConverter, ExtractedEnum, ExtractedIdentity, ExtractedInterface, ExtractedInterfaceProp, ExtractedModelGroup } from './types.js';

/**
 * Field names that show up on many models and shouldn't seed
 * {@link FirebaseModel.detectionHints}. Matches the `.mjs`
 * extractor's `COMMON_FIELDS` set.
 */
export const COMMON_FIELDS: ReadonlySet<string> = new Set(['cat', 'o', 'u', 's', 'fi', 'uid', 'mat', 'd']);

const LONG_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Marker-interface name for documents whose Firestore id IS the user's
 * Firebase Auth uid (sourced from `@dereekb/firebase` `user.ts`).
 */
export const USER_KEYED_BY_ID_MARKER = 'UserRelatedById';

/**
 * Marker-interface name for documents that carry an explicit `uid` field
 * referencing a Firebase Auth user (sourced from `@dereekb/firebase`
 * `user.ts`; alias of `FirebaseAuthUserIdRef`).
 */
export const USER_RELATED_MARKER = 'UserRelated';

/**
 * Marker-interface name for documents whose Firestore id IS a region key.
 * Mirrors `REGION_KEYED_BY_ID_MARKER` in the `.mjs` extractor.
 */
export const REGION_KEYED_BY_ID_MARKER = 'RegionRelatedById';

/**
 * Marker-interface name for documents whose Firestore id IS a district key.
 * Mirrors `DISTRICT_KEYED_BY_ID_MARKER` in the `.mjs` extractor.
 */
export const DISTRICT_KEYED_BY_ID_MARKER = 'DistrictRelatedById';

/**
 * Marker-interface name for documents whose Firestore id IS an external
 * vendor's id, regardless of which vendor. Models extend
 * `ExternalRelatedById<TId>` from `@dereekb/firebase`.
 */
export const EXTERNAL_ID_KEYED_BY_ID_MARKER = 'ExternalRelatedById';

/**
 * Marker-interface name suffixes for documents keyed by a temporal bucket
 * code (year-week, year-month, …). Matched as suffixes so per-bucket markers
 * like `YearWeekRelatedById` and `WeekRelatedById` are picked up.
 */
export const BUCKET_KEYED_BY_ID_SUFFIXES: readonly string[] = ['YearWeekRelatedById', 'YearMonthRelatedById', 'WeekRelatedById', 'MonthRelatedById', 'BucketKeyRelatedById'];

/**
 * Result of assembling one source file's models + groups.
 */
export interface AssembledFile {
  readonly models: readonly FirebaseModel[];
  readonly modelGroups: readonly FirebaseModelGroup[];
}

/**
 * Configuration for assembling one source file.
 */
export interface AssembleFileInput {
  readonly sourcePackage: string;
  readonly sourceFile: string;
  readonly identities: readonly ExtractedIdentity[];
  readonly interfaces: readonly ExtractedInterface[];
  readonly converters: readonly ExtractedConverter[];
  readonly enums: readonly ExtractedEnum[];
  readonly modelGroups: readonly ExtractedModelGroup[];
  readonly factoryKinds: ReadonlyMap<string, FirestoreCollectionKind>;
  /**
   * Cross-file sub-object index built by the extractor's pre-pass. Maps
   * a sub-object factory const name (e.g. `workerPayStubItem`) to the
   * record describing the underlying interface plus its factory shape.
   * When omitted (e.g. legacy callers, tests that don't exercise
   * sub-objects), the assembler skips field-level sub-object resolution.
   */
  readonly subObjectConstIndex?: ReadonlyMap<string, SubObjectConstEntry>;
  /**
   * Cross-file map of `@dbxModelSubObject`-tagged interface declarations
   * keyed by interface name. Used together with {@link subObjectConstIndex}
   * to recursively render nested sub-objects in the catalog.
   */
  readonly subObjectInterfaceIndex?: ReadonlyMap<string, ExtractedInterface>;
}

/**
 * One entry in the cross-file sub-object const index. The
 * {@link interfaceName} resolves to a tagged
 * `@dbxModelSubObject` declaration in
 * {@link AssembleFileInput.subObjectInterfaceIndex}; the
 * {@link factoryKind} drives the catalog's section label
 * (`object` / `array` / `map`).
 */
export interface SubObjectConstEntry {
  readonly interfaceName: string;
  readonly factoryKind: FirebaseSubObject['factoryKind'];
}

/**
 * Combines the per-file extraction outputs into ready-to-publish
 * {@link FirebaseModel} / {@link FirebaseModelGroup} entries.
 *
 * @param input - the per-file extraction outputs
 * @returns the assembled models and groups for the file
 */
export function assembleFile(input: AssembleFileInput): AssembledFile {
  const interfaceByName = buildInterfaceIndex(input.interfaces);
  const converterByInterface = buildConverterIndex(input.converters);
  const enumNames = new Set(input.enums.map((e) => e.name));
  const groupByModelName = buildGroupByModelName(input.modelGroups);

  const models: FirebaseModel[] = [];
  for (const id of input.identities) {
    const built = buildModelEntry({
      id,
      interfaceByName,
      converterByInterface,
      enumNames,
      groupByModelName,
      input
    });
    if (built) {
      models.push(built);
    }
  }

  const modelGroups: FirebaseModelGroup[] = input.modelGroups.map((g) => ({
    name: g.name,
    containerName: g.containerName,
    sourcePackage: input.sourcePackage,
    sourceFile: input.sourceFile,
    ...(g.description ? { description: g.description } : {}),
    modelNames: g.modelNames
  }));

  return { models, modelGroups };
}

function buildInterfaceIndex(interfaces: readonly ExtractedInterface[]): Map<string, ExtractedInterface> {
  const interfaceByName = new Map<string, ExtractedInterface>();
  for (const iface of interfaces) interfaceByName.set(iface.name, iface);
  return interfaceByName;
}

function buildConverterIndex(converters: readonly ExtractedConverter[]): Map<string, ExtractedConverter> {
  const converterByInterface = new Map<string, ExtractedConverter>();
  for (const c of converters) converterByInterface.set(c.interfaceName, c);
  return converterByInterface;
}

function buildGroupByModelName(modelGroups: readonly ExtractedModelGroup[]): Map<string, string> {
  const groupByModelName = new Map<string, string>();
  for (const group of modelGroups) {
    for (const modelName of group.modelNames) groupByModelName.set(modelName, group.name);
  }
  return groupByModelName;
}

interface BuildModelEntryInput {
  readonly id: ExtractedIdentity;
  readonly interfaceByName: ReadonlyMap<string, ExtractedInterface>;
  readonly converterByInterface: ReadonlyMap<string, ExtractedConverter>;
  readonly enumNames: ReadonlySet<string>;
  readonly groupByModelName: ReadonlyMap<string, string>;
  readonly input: AssembleFileInput;
}

function buildModelEntry(args: BuildModelEntryInput): FirebaseModel | undefined {
  const { id, interfaceByName, converterByInterface, enumNames, groupByModelName, input } = args;
  const modelName = capitalize(id.modelType);
  const iface = interfaceByName.get(modelName);
  if (!iface?.tags.dbxModel) return undefined;
  const converter = converterByInterface.get(modelName);
  if (!converter) return undefined;
  const collectionPrefix = id.collectionPrefix;
  if (collectionPrefix === undefined) return undefined;

  const inheritedProps = collectInheritedProps(iface, interfaceByName);
  const fields = buildFields({
    converter,
    inheritedProps,
    enumNames,
    subObjectConstIndex: input.subObjectConstIndex,
    subObjectInterfaceIndex: input.subObjectInterfaceIndex
  });
  const referencedEnums = new Set(fields.flatMap((f) => (f.enumRef ? [f.enumRef] : [])));
  const relevantEnums = input.enums.filter((e) => referencedEnums.has(e.name));
  const detectionHints = fields.map((f) => f.name).filter((n) => !COMMON_FIELDS.has(n));
  const factoryFnName = id.parentIdentityConst ? `${id.modelType}FirestoreCollectionFactory` : `${id.modelType}FirestoreCollection`;
  const collectionKind = input.factoryKinds.get(factoryFnName);
  const groupName = groupByModelName.get(modelName);
  const extendedNames = collectExtendedNames(iface, interfaceByName);
  const userKeyedById = extendedNames.has(USER_KEYED_BY_ID_MARKER);
  const hasUserUidField = extendedNames.has(USER_RELATED_MARKER);
  const regionKeyedById = extendedNames.has(REGION_KEYED_BY_ID_MARKER);
  const districtKeyedById = extendedNames.has(DISTRICT_KEYED_BY_ID_MARKER);
  const externalIdKeyedById = extendedNames.has(EXTERNAL_ID_KEYED_BY_ID_MARKER);
  const bucketKeyedById = BUCKET_KEYED_BY_ID_SUFFIXES.some((s) => hasNameWithSuffix(extendedNames, s));
  const isRoot = !id.parentIdentityConst;
  const organizationalGroupRoot = iface.tags.dbxModelOrganizationalGroupRoot;
  const aggregatesFrom = iface.tags.dbxModelAggregatesFrom;
  const aggregatesFromNonEmpty = aggregatesFrom.length > 0;
  const overrideTags = iface.tags.dbxModelArchetypes;
  const inferred = inferArchetype({
    isRoot,
    collectionKind,
    userKeyedById,
    regionKeyedById,
    districtKeyedById,
    externalIdKeyedById,
    bucketKeyedById,
    organizationalGroupRoot,
    aggregatesFromNonEmpty
  });
  const finalArchetypes: readonly InferredArchetype[] = overrideTags.length > 0 ? overrideTags.map((t) => ({ slug: t.slug, axes: t.axes })) : inferred;
  const archetypes = finalArchetypes.map((a) => a.slug);
  const archetypeAxesEntries = finalArchetypes.filter((a) => Object.keys(a.axes).length > 0).map((a) => [a.slug, a.axes] as const);
  const archetypeAxesBySlug = archetypeAxesEntries.length > 0 ? Object.fromEntries(archetypeAxesEntries) : undefined;
  // Only surface a fully well-formed compositeKey on the registry entry —
  // malformed tags (missing `from`, invalid encoding, wildcard mixed with
  // concrete names) are left for the validator to flag against source.
  const rawCompositeKey = iface.tags.dbxModelCompositeKey;
  let compositeKey: { readonly from: readonly string[] | '*'; readonly encoding: 'two-way' | 'one-way' } | undefined;
  if (rawCompositeKey !== undefined && rawCompositeKey.encoding !== undefined) {
    const from = rawCompositeKey.from;
    const fromIsWildcard = from === '*';
    const fromIsClosedList = Array.isArray(from) && from.length > 0 && !from.includes('*');
    if (fromIsWildcard) {
      compositeKey = { from: '*', encoding: rawCompositeKey.encoding };
    } else if (fromIsClosedList) {
      compositeKey = { from: from as readonly string[], encoding: rawCompositeKey.encoding };
    }
  }

  return {
    name: modelName,
    ...(iface.description ? { description: iface.description } : {}),
    identityConst: id.identityConst,
    modelType: id.modelType,
    collectionPrefix,
    ...(id.parentIdentityConst ? { parentIdentityConst: id.parentIdentityConst } : {}),
    sourcePackage: input.sourcePackage,
    sourceFile: input.sourceFile,
    fields,
    enums: relevantEnums.map((e) => ({
      name: e.name,
      values: e.values.map((v) => (v.description ? { name: v.name, value: v.value, description: v.description } : { name: v.name, value: v.value })),
      ...(e.description ? { description: e.description } : {})
    })),
    detectionHints,
    ...(groupName ? { modelGroup: groupName } : {}),
    ...(collectionKind ? { collectionKind } : {}),
    ...(userKeyedById ? { userKeyedById: true } : {}),
    ...(hasUserUidField ? { hasUserUidField: true } : {}),
    ...(regionKeyedById ? { regionKeyedById: true } : {}),
    ...(districtKeyedById ? { districtKeyedById: true } : {}),
    ...(externalIdKeyedById ? { externalIdKeyedById: true } : {}),
    ...(bucketKeyedById ? { bucketKeyedById: true } : {}),
    ...(organizationalGroupRoot ? { organizationalGroupRoot: true } : {}),
    ...(aggregatesFromNonEmpty ? { aggregatesFrom } : {}),
    ...(archetypes.length > 0 ? { archetypes } : {}),
    ...(archetypeAxesBySlug ? { archetypeAxesBySlug } : {}),
    ...(compositeKey ? { compositeKey } : {})
  };
}

function hasNameWithSuffix(names: ReadonlySet<string>, suffix: string): boolean {
  let result = false;
  for (const name of names) {
    if (name.endsWith(suffix)) {
      result = true;
      break;
    }
  }
  return result;
}

interface InferArchetypeInput {
  readonly isRoot: boolean;
  readonly collectionKind: FirestoreCollectionKind | undefined;
  readonly userKeyedById: boolean;
  readonly regionKeyedById: boolean;
  readonly districtKeyedById: boolean;
  readonly externalIdKeyedById: boolean;
  readonly bucketKeyedById: boolean;
  readonly organizationalGroupRoot: boolean;
  readonly aggregatesFromNonEmpty: boolean;
}

interface InferredArchetype {
  readonly slug: string;
  readonly axes: { readonly [key: string]: string };
}

/**
 * Mirrors `scripts/extract-firebase-models.mjs:inferArchetype`. Returns a
 * high-confidence archetype tag list derived from doc-id keying +
 * collection-kind + JSDoc-marker signals, or an empty array when no obvious
 * tag applies. The `.mjs` script's heuristic is canonical — keep this in sync
 * if either changes.
 *
 * Each rule emits a single slug. A root collection whose doc id is itself a
 * geo key (`regionKey` / `districtKey`) falls through to `root-entity` — the
 * composite-key / tree-node distinctions require explicit `@dbxModelArchetype`
 * tagging since the heuristic can't infer composite-flat-key encoding or
 * tree-chain participation from pure-key signals alone.
 *
 * @param input - the signals the heuristic consumes (root vs. sub, marker-interface flags, collection kind, JSDoc markers)
 * @returns the inferred archetypes (possibly empty)
 */
function inferArchetype(input: InferArchetypeInput): readonly InferredArchetype[] {
  let result: readonly InferredArchetype[] = [];
  if (input.bucketKeyedById && input.isRoot) {
    result = [{ slug: 'denormalised-aggregate', axes: { keying: 'bucket-code' } }];
  } else if (input.userKeyedById && input.isRoot) {
    result = [{ slug: 'user-keyed-entity-root', axes: {} }];
  } else if (input.externalIdKeyedById && input.isRoot) {
    result = [{ slug: 'external-id-keyed-entity-root', axes: {} }];
  } else if (input.collectionKind === 'root-singleton' && input.aggregatesFromNonEmpty) {
    result = [{ slug: 'root-singleton-aggregate', axes: {} }];
  } else if (input.collectionKind === 'root-singleton') {
    result = [{ slug: 'system-state-singleton', axes: {} }];
  } else if (input.collectionKind === 'singleton-sub') {
    result = [{ slug: 'single-item-sub', axes: {} }];
  } else if (input.collectionKind === 'sub-collection' && !input.isRoot) {
    result = [{ slug: 'sub-collection-entity', axes: {} }];
  } else if (input.isRoot && input.organizationalGroupRoot) {
    result = [{ slug: 'group-root', axes: {} }];
  } else if (input.collectionKind === 'root' && input.isRoot) {
    result = [{ slug: 'root-entity', axes: {} }];
  }
  return result;
}

interface BuildFieldsInput {
  readonly converter: ExtractedConverter;
  readonly inheritedProps: ReadonlyMap<string, { readonly name: string; readonly tsType: string; readonly optional: boolean; readonly description: string | undefined; readonly longName: string | undefined; readonly syncFlag: string | undefined }>;
  readonly enumNames: ReadonlySet<string>;
  readonly subObjectConstIndex?: ReadonlyMap<string, SubObjectConstEntry>;
  readonly subObjectInterfaceIndex?: ReadonlyMap<string, ExtractedInterface>;
}

function buildFields(input: BuildFieldsInput): readonly FirebaseField[] {
  const out: FirebaseField[] = [];
  for (const f of input.converter.fields) {
    const prop = input.inheritedProps.get(f.key);
    const enumFromType = prop?.tsType ? findEnumInType(prop.tsType, input.enumNames) : undefined;
    const enumFromConverter = findEnumInConverter(f.converter, input.enumNames);
    const enumRef = enumFromType ?? enumFromConverter;
    const optional = prop?.optional ?? f.converter.startsWith('optionalFirestore');
    const longName = resolveLongName(f.key, prop?.longName);
    const subObject = resolveFieldSubObject({
      converter: f.converter,
      subObjectConstIndex: input.subObjectConstIndex,
      subObjectInterfaceIndex: input.subObjectInterfaceIndex,
      enumNames: input.enumNames
    });
    const field: FirebaseField = {
      name: f.key,
      longName,
      converter: f.converter,
      ...(prop?.tsType ? { tsType: prop.tsType } : {}),
      optional,
      ...(prop?.description ? { description: prop.description } : {}),
      ...(enumRef ? { enumRef } : {}),
      ...(prop?.syncFlag ? { syncFlag: prop.syncFlag } : {}),
      ...(subObject ? { subObject } : {})
    };
    out.push(field);
  }
  return out;
}

interface ResolveFieldSubObjectInput {
  readonly converter: string;
  readonly subObjectConstIndex: ReadonlyMap<string, SubObjectConstEntry> | undefined;
  readonly subObjectInterfaceIndex: ReadonlyMap<string, ExtractedInterface> | undefined;
  readonly enumNames: ReadonlySet<string>;
}

/**
 * Detects whether a field's converter expression references a known
 * `firestoreSubObject<T>` / `firestoreObjectArray<T>` / `firestoreMap<T>`
 * const and, when it does, expands the underlying interface into a
 * {@link FirebaseSubObject} structure for the catalog.
 *
 * Recognised converter shapes (string-matched against the canonical
 * forms `find-converters.ts` collapses to):
 *   - `firestoreSubObject<T>(...)` / `firestoreObjectArray<T>(...)` /
 *     `firestoreMap<T>(...)` — anonymous call site at the field
 *   - `<constName>` — shorthand reference to an exported sub-object const
 *   - `firestoreObjectArray({ objectField: <constName> })` — wrapped
 *     reference; also handles `firestoreMap`
 *
 * When the type-arg or referenced const resolves to an interface in
 * {@link subObjectInterfaceIndex}, the sub-object's own fields are
 * built recursively so nested embedded structures surface end-to-end.
 *
 * @param input - converter expression + cross-file indices
 * @returns the sub-object metadata, or `undefined` when the converter doesn't reference a known sub-object
 */
function resolveFieldSubObject(input: ResolveFieldSubObjectInput): FirebaseSubObject | undefined {
  const { converter, subObjectConstIndex, subObjectInterfaceIndex, enumNames } = input;
  if (!subObjectConstIndex || !subObjectInterfaceIndex) {
    return undefined;
  }
  const resolved = resolveSubObjectReference(converter, subObjectConstIndex);
  if (!resolved) {
    return undefined;
  }
  const iface = subObjectInterfaceIndex.get(resolved.interfaceName);
  if (!iface) {
    return undefined;
  }
  const fields = buildSubObjectFields({ iface, subObjectConstIndex, subObjectInterfaceIndex, enumNames, visited: new Set([resolved.interfaceName]) });
  return { interfaceName: resolved.interfaceName, factoryKind: resolved.factoryKind, fields };
}

interface SubObjectResolution {
  readonly interfaceName: string;
  readonly factoryKind: FirebaseSubObject['factoryKind'];
}

const INLINE_SUB_OBJECT_RE = /^(firestoreSubObject|firestoreObjectArray|firestoreMap)\s*<\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*>/;
const WRAPPED_OBJECT_FIELD_RE = /^(firestoreObjectArray|firestoreMap)\s*\(\s*\{\s*objectField:\s*([A-Za-z_$][A-Za-z0-9_$]*)/;

function resolveSubObjectReference(converter: string, index: ReadonlyMap<string, SubObjectConstEntry>): SubObjectResolution | undefined {
  let result: SubObjectResolution | undefined;
  const trimmed = converter.trim();
  const inline = INLINE_SUB_OBJECT_RE.exec(trimmed);
  if (inline) {
    result = { interfaceName: inline[2], factoryKind: FACTORY_KIND_BY_NAME[inline[1] as keyof typeof FACTORY_KIND_BY_NAME] };
  } else {
    const wrapped = WRAPPED_OBJECT_FIELD_RE.exec(trimmed);
    if (wrapped) {
      const entry = index.get(wrapped[2]);
      if (entry) {
        const outerKind = FACTORY_KIND_BY_NAME[wrapped[1] as keyof typeof FACTORY_KIND_BY_NAME];
        result = { interfaceName: entry.interfaceName, factoryKind: outerKind };
      }
    } else {
      const entry = index.get(trimmed);
      if (entry) {
        result = { interfaceName: entry.interfaceName, factoryKind: entry.factoryKind };
      }
    }
  }
  return result;
}

const FACTORY_KIND_BY_NAME: Readonly<Record<'firestoreSubObject' | 'firestoreObjectArray' | 'firestoreMap', FirebaseSubObject['factoryKind']>> = {
  firestoreSubObject: 'object',
  firestoreObjectArray: 'array',
  firestoreMap: 'map'
};

interface BuildSubObjectFieldsInput {
  readonly iface: ExtractedInterface;
  readonly subObjectConstIndex: ReadonlyMap<string, SubObjectConstEntry>;
  readonly subObjectInterfaceIndex: ReadonlyMap<string, ExtractedInterface>;
  readonly enumNames: ReadonlySet<string>;
  readonly visited: Set<string>;
}

/**
 * Recursively builds the catalog field list for an embedded sub-object
 * interface. Walks the interface's own props (the catalog can't see
 * through the sub-object's converter without the converter being
 * declared, so it leans on the interface declaration for the surface);
 * for each prop whose tsType matches a known sub-object interface,
 * recurses to attach the nested {@link FirebaseSubObject} structure.
 *
 * Cycle protection via the `visited` set guards against a
 * self-referential sub-object chain that would otherwise stack-overflow.
 *
 * @param input - interface + cross-file indices + cycle-detection set
 * @returns the sub-object's own fields with nested sub-objects resolved
 */
function buildSubObjectFields(input: BuildSubObjectFieldsInput): readonly FirebaseField[] {
  const out: FirebaseField[] = [];
  for (const prop of input.iface.props) {
    out.push(buildSubObjectField({ prop, ...input }));
  }
  return out;
}

interface BuildSubObjectFieldInput extends BuildSubObjectFieldsInput {
  readonly prop: ExtractedInterfaceProp;
}

function buildSubObjectField(input: BuildSubObjectFieldInput): FirebaseField {
  const { prop, subObjectConstIndex, subObjectInterfaceIndex, enumNames, visited } = input;
  const enumRef = prop.tsType ? findEnumInType(prop.tsType, enumNames) : undefined;
  const longName = resolveLongName(prop.name, prop.longName);
  const nested = resolveNestedSubObjectFromType({ tsType: prop.tsType, subObjectConstIndex, subObjectInterfaceIndex, enumNames, visited });
  const field: FirebaseField = {
    name: prop.name,
    longName,
    converter: '',
    ...(prop.tsType ? { tsType: prop.tsType } : {}),
    optional: prop.optional,
    ...(prop.description ? { description: prop.description } : {}),
    ...(enumRef ? { enumRef } : {}),
    ...(prop.syncFlag ? { syncFlag: prop.syncFlag } : {}),
    ...(nested ? { subObject: nested } : {})
  };
  return field;
}

interface ResolveNestedSubObjectFromTypeInput {
  readonly tsType: string;
  readonly subObjectConstIndex: ReadonlyMap<string, SubObjectConstEntry>;
  readonly subObjectInterfaceIndex: ReadonlyMap<string, ExtractedInterface>;
  readonly enumNames: ReadonlySet<string>;
  readonly visited: Set<string>;
}

/**
 * Inspects a TS-type string (e.g. `WorkerPayStubItem[]`, `Maybe<X>`) and
 * resolves it to a nested {@link FirebaseSubObject} when the underlying
 * identifier names a tagged `@dbxModelSubObject` interface in
 * {@link subObjectInterfaceIndex}. Returns `undefined` for non-sub-object
 * types or when the chain would revisit an already-walked interface.
 *
 * @param input - the type string plus the same indices the parent walk uses
 * @returns the resolved sub-object, or `undefined` when no resolution applies
 */
function resolveNestedSubObjectFromType(input: ResolveNestedSubObjectFromTypeInput): FirebaseSubObject | undefined {
  const { tsType, subObjectInterfaceIndex, visited } = input;
  if (!tsType) return undefined;
  const peeled = peelArrayAndMaybe(tsType.trim());
  if (!peeled) return undefined;
  if (visited.has(peeled.name)) return undefined;
  const iface = subObjectInterfaceIndex.get(peeled.name);
  if (!iface) return undefined;
  const nestedVisited = new Set(visited);
  nestedVisited.add(peeled.name);
  const fields = buildSubObjectFields({
    iface,
    subObjectConstIndex: input.subObjectConstIndex,
    subObjectInterfaceIndex,
    enumNames: input.enumNames,
    visited: nestedVisited
  });
  return { interfaceName: peeled.name, factoryKind: peeled.array ? 'array' : 'object', fields };
}

function peelArrayAndMaybe(raw: string): { readonly name: string; readonly array: boolean } | undefined {
  let current = raw;
  let array = false;
  const maybeMatch = /^Maybe<\s*(.+)\s*>$/.exec(current);
  if (maybeMatch) {
    current = maybeMatch[1].trim();
  }
  const readonlyArrayMatch = /^ReadonlyArray<\s*(.+)\s*>$/.exec(current);
  if (readonlyArrayMatch) {
    current = readonlyArrayMatch[1].trim();
    array = true;
  } else {
    const arrayMatch = /^(?:readonly\s+)?(.+?)(\s*\[\s*\])$/.exec(current);
    if (arrayMatch) {
      current = arrayMatch[1].trim();
      array = true;
    }
  }
  if (!/^[A-Z][A-Za-z0-9_$]*$/.test(current)) {
    return undefined;
  }
  return { name: current, array };
}

function resolveLongName(fieldName: string, propLongName: string | undefined): string {
  let result: string;
  if (propLongName && LONG_NAME_RE.test(propLongName)) {
    result = propLongName;
  } else {
    result = fieldName;
  }
  return result;
}

function findEnumInType(tsType: string, enumNames: ReadonlySet<string>): string | undefined {
  let result: string | undefined;
  for (const name of enumNames) {
    const re = new RegExp(String.raw`\b${name}\b`);
    if (re.test(tsType)) {
      result = name;
      break;
    }
  }
  return result;
}

function findEnumInConverter(expr: string, enumNames: ReadonlySet<string>): string | undefined {
  const m = /firestoreEnum<(\w+)>|optionalFirestoreEnum<(\w+)>/.exec(expr);
  let result: string | undefined;
  if (m) {
    const name = m[1] ?? m[2];
    if (enumNames.has(name)) result = name;
  }
  return result;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Collects every interface name reachable from `iface` via `extends`,
 * walking through same-file ancestors. Names whose declarations live in
 * other files (e.g. `UserRelatedById`, `UserRelated` from
 * `@dereekb/firebase`'s `user.ts`) are still recorded — they appear in
 * some descendant's `extendsNames` list, which is what we need for
 * marker-name detection.
 *
 * @param iface - the interface to start from
 * @param interfaceByName - lookup map of interfaces in the same file
 * @returns the set of every transitively extended interface name
 */
function collectExtendedNames(iface: ExtractedInterface, interfaceByName: ReadonlyMap<string, ExtractedInterface>): ReadonlySet<string> {
  const out = new Set<string>();
  const visited = new Set<string>();
  const stack: ExtractedInterface[] = [iface];
  while (stack.length > 0) {
    const current = stack.pop() as ExtractedInterface;
    if (visited.has(current.name)) continue;
    visited.add(current.name);
    for (const parentName of current.extendsNames) {
      out.add(parentName);
      const parent = interfaceByName.get(parentName);
      if (parent) stack.push(parent);
    }
  }
  return out;
}

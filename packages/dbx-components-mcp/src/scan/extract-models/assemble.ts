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

import type { FirebaseField, FirebaseModel, FirebaseModelGroup } from '../../registry/firebase-models.js';
import type { FirestoreCollectionKind } from '../../tools/model-validate/types.js';
import { collectInheritedProps } from './collect-inherited.js';
import type { ExtractedConverter, ExtractedEnum, ExtractedIdentity, ExtractedInterface, ExtractedModelGroup } from './types.js';

/**
 * Field names that show up on many models and shouldn't seed
 * {@link FirebaseModel.detectionHints}. Matches the `.mjs`
 * extractor's `COMMON_FIELDS` set.
 */
export const COMMON_FIELDS: ReadonlySet<string> = new Set(['cat', 'o', 'u', 's', 'fi', 'uid', 'mat', 'd']);

const LONG_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

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
}

/**
 * Combines the per-file extraction outputs into ready-to-publish
 * {@link FirebaseModel} / {@link FirebaseModelGroup} entries.
 *
 * @param input - the per-file extraction outputs
 * @returns the assembled models and groups for the file
 */
export function assembleFile(input: AssembleFileInput): AssembledFile {
  const interfaceByName = new Map<string, ExtractedInterface>();
  for (const iface of input.interfaces) interfaceByName.set(iface.name, iface);
  const converterByInterface = new Map<string, ExtractedConverter>();
  for (const c of input.converters) converterByInterface.set(c.interfaceName, c);
  const enumNames = new Set(input.enums.map((e) => e.name));
  const groupByModelName = new Map<string, string>();
  for (const group of input.modelGroups) {
    for (const modelName of group.modelNames) groupByModelName.set(modelName, group.name);
  }

  const models: FirebaseModel[] = [];
  for (const id of input.identities) {
    const modelName = capitalize(id.modelType);
    const iface = interfaceByName.get(modelName);
    if (!iface?.tags.dbxModel) continue;
    const converter = converterByInterface.get(modelName);
    if (!converter) continue;
    const collectionPrefix = id.collectionPrefix;
    if (collectionPrefix === undefined) continue;

    const inheritedProps = collectInheritedProps(iface, interfaceByName);
    const fields = buildFields({
      converter,
      inheritedProps,
      enumNames
    });
    const referencedEnums = new Set(fields.flatMap((f) => (f.enumRef ? [f.enumRef] : [])));
    const relevantEnums = input.enums.filter((e) => referencedEnums.has(e.name));
    const detectionHints = fields.map((f) => f.name).filter((n) => !COMMON_FIELDS.has(n));
    const factoryFnName = id.parentIdentityConst ? `${id.modelType}FirestoreCollectionFactory` : `${id.modelType}FirestoreCollection`;
    const collectionKind = input.factoryKinds.get(factoryFnName);
    const groupName = groupByModelName.get(modelName);

    const entry: FirebaseModel = {
      name: modelName,
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
      ...(collectionKind ? { collectionKind } : {})
    };
    models.push(entry);
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

interface BuildFieldsInput {
  readonly converter: ExtractedConverter;
  readonly inheritedProps: ReadonlyMap<string, { readonly name: string; readonly tsType: string; readonly optional: boolean; readonly description: string | undefined; readonly longName: string | undefined }>;
  readonly enumNames: ReadonlySet<string>;
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
    const field: FirebaseField = {
      name: f.key,
      longName,
      converter: f.converter,
      ...(prop?.tsType ? { tsType: prop.tsType } : {}),
      optional,
      ...(prop?.description ? { description: prop.description } : {}),
      ...(enumRef ? { enumRef } : {})
    };
    out.push(field);
  }
  return out;
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
  const m = expr.match(/firestoreEnum<(\w+)>|optionalFirestoreEnum<(\w+)>/);
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

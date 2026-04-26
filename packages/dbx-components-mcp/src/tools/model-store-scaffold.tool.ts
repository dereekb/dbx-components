/**
 * `dbx_model_store_scaffold` tool.
 *
 * Generates the conventional store files for a Firestore model in the
 * dbx-components ecosystem. Pure synchronous string templating: no I/O, no
 * registry coupling. Output is a markdown bundle of fenced TypeScript blocks,
 * one per emitted file, each prefixed with the relative file path.
 *
 * Supports all five store shapes documented in
 * `dbx_model_lookup topic="shapes"`:
 *
 *   • `root` — `AbstractDbxFirebase{Document,Collection}Store`, paired with
 *     directives. Default surfaces: ['document', 'collection'].
 *   • `root-singleton` — `AbstractRootSingleItemDbxFirebaseDocument`. No
 *     collection sibling; document directive optional. Default surfaces:
 *     ['document'].
 *   • `sub-collection` — `AbstractDbxFirebase{Document,Collection}WithParentStore`,
 *     parent injection + `setParentStore`. Default surfaces:
 *     ['document', 'collection'].
 *   • `singleton-sub` — `AbstractSingleItemDbxFirebaseDocument`. No collection
 *     sibling; document directive optional. Default surfaces: ['document'].
 *   • `system-state` — `AbstractSystemStateDocumentStoreAccessor`, file suffix
 *     `.store.accessor.ts`, no directive, no collection. Default surfaces:
 *     ['document'].
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Shape definitions
type StoreShape = 'root' | 'root-singleton' | 'sub-collection' | 'singleton-sub' | 'system-state';
type Surface = 'document' | 'collection';
type CrudKind = 'create' | 'update' | 'crud';

const STORE_SHAPES: readonly StoreShape[] = ['root', 'root-singleton', 'sub-collection', 'singleton-sub', 'system-state'] as const;

interface ShapeProfile {
  readonly defaultSurfaces: readonly Surface[];
  readonly allowedSurfaces: readonly Surface[];
  readonly hasParent: boolean;
  readonly emitsDirectives: boolean;
  readonly requiresCollectionsClass: boolean;
  readonly requiresSystemStateTypeConst: boolean;
}

const SHAPE_PROFILES: Readonly<Record<StoreShape, ShapeProfile>> = {
  root: { defaultSurfaces: ['document', 'collection'], allowedSurfaces: ['document', 'collection'], hasParent: false, emitsDirectives: true, requiresCollectionsClass: true, requiresSystemStateTypeConst: false },
  'root-singleton': { defaultSurfaces: ['document'], allowedSurfaces: ['document'], hasParent: false, emitsDirectives: true, requiresCollectionsClass: true, requiresSystemStateTypeConst: false },
  'sub-collection': { defaultSurfaces: ['document', 'collection'], allowedSurfaces: ['document', 'collection'], hasParent: true, emitsDirectives: true, requiresCollectionsClass: true, requiresSystemStateTypeConst: false },
  'singleton-sub': { defaultSurfaces: ['document'], allowedSurfaces: ['document'], hasParent: true, emitsDirectives: true, requiresCollectionsClass: true, requiresSystemStateTypeConst: false },
  'system-state': { defaultSurfaces: ['document'], allowedSurfaces: ['document'], hasParent: false, emitsDirectives: false, requiresCollectionsClass: false, requiresSystemStateTypeConst: true }
};

// MARK: Tool definition
const DBX_MODEL_STORE_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_model_store_scaffold',
  description: [
    'Scaffold the conventional store files for a Firestore model in dbx-components.',
    '',
    'Supports all five shapes from `dbx_model_lookup topic="shapes"`:',
    '  • `root` — paired document + collection stores with directives (default).',
    '  • `root-singleton` — `AbstractRootSingleItemDbxFirebaseDocument`; doc-only.',
    '  • `sub-collection` — `*WithParentStore` bases, parent injection + `setParentStore`.',
    '  • `singleton-sub` — `AbstractSingleItemDbxFirebaseDocument`; doc-only, parent injection.',
    '  • `system-state` — `AbstractSystemStateDocumentStoreAccessor`; file suffix `.store.accessor.ts`, no directive.',
    '',
    'Common inputs:',
    '  • `model_name` — PascalCase model name (e.g. "Guestbook", "JobApplication").',
    '  • `app_prefix` — lowercase app prefix (e.g. "demo", "hellosubs"). Drives directive class + selector prefix.',
    '  • `firebase_package` — module specifier of the firebase model package (e.g. "demo-firebase").',
    '  • `shape` — one of the five store shapes (default `root`).',
    '  • `surfaces` — defaults vary by shape; `root`/`sub-collection` get both, others only `document`.',
    '  • `file_base_name` — overrides the auto-derived filename basename (default = lowercased model name).',
    '',
    'Shape-specific inputs:',
    '  • `collections_class` — required for all except `system-state` (e.g. "DemoFirestoreCollections").',
    '  • `collection_accessor` — root/root-singleton: defaults to `<modelCamel>Collection`.',
    '  • `factory_accessor` / `group_accessor` — sub/singleton-sub: default to `<modelCamel>CollectionFactory` / `<modelCamel>CollectionGroup`.',
    '  • `parent_model: { name, document_type? }` — required for `sub-collection` + `singleton-sub`.',
    '  • `system_state_type_const` — required for `system-state` (e.g. "HELLOSUBS_CHECKHQ_COMPANY_SYSTEM_STATE_TYPE").',
    '  • `data_type` — required for `system-state` (e.g. "HellosubsCheckHqCompanySystemData").',
    '',
    'Function wiring (any shape with a document store):',
    '  • `functions_class` — optional functions class injected by the document store / accessor.',
    '  • `crud_functions: { name, kind, functions_path }[]` — optional list of `firebaseDocumentStore{Create,Update,Crud}Function` lines. Requires `functions_class`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      model_name: { type: 'string', description: 'PascalCase model name.' },
      app_prefix: { type: 'string', description: 'Lowercase app prefix.' },
      firebase_package: { type: 'string', description: 'Module specifier of the firebase model package.' },
      shape: { type: 'string', enum: STORE_SHAPES as readonly string[], description: "Store shape; defaults to 'root'." },
      collections_class: { type: 'string', description: 'Firestore-collections class name (required except for system-state).' },
      collection_accessor: { type: 'string', description: 'Root collection accessor name. Defaults to `<modelCamel>Collection`.' },
      factory_accessor: { type: 'string', description: 'Sub-collection factory accessor. Defaults to `<modelCamel>CollectionFactory`.' },
      group_accessor: { type: 'string', description: 'Sub-collection group accessor. Defaults to `<modelCamel>CollectionGroup`.' },
      parent_model: {
        type: 'object',
        description: 'Parent-model identity (sub-collection / singleton-sub only).',
        properties: {
          name: { type: 'string', description: 'PascalCase parent model name.' },
          document_type: { type: 'string', description: 'Parent document-type alias. Defaults to `<name>Document`.' }
        },
        required: ['name']
      },
      system_state_type_const: { type: 'string', description: 'SystemStateTypeIdentifier constant name (system-state only).' },
      data_type: { type: 'string', description: 'TypeScript type alias for the system-state data payload (system-state only).' },
      functions_class: { type: 'string', description: 'Optional functions class injected by the store.' },
      create_function: {
        type: 'object',
        description: '[Deprecated] Single create-function shortcut. Prefer `crud_functions`. Requires `functions_class`.',
        properties: {
          name: { type: 'string' },
          functions_path: { type: 'string' }
        },
        required: ['name', 'functions_path']
      },
      crud_functions: {
        type: 'array',
        description: 'Function-helper lines on the document store / accessor. Requires `functions_class`.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Public field name (e.g. "createGuestbook").' },
            kind: { type: 'string', enum: ['create', 'update', 'crud'], description: 'Helper variant.' },
            functions_path: { type: 'string', description: 'Dot-path under the functions class (e.g. "guestbook.createGuestbook").' }
          },
          required: ['name', 'kind', 'functions_path']
        }
      },
      file_base_name: { type: 'string', description: 'Override the auto-derived filename basename (default = lowercased model name).' },
      surfaces: {
        type: 'array',
        items: { type: 'string', enum: ['document', 'collection'] },
        description: 'Surfaces to emit. Defaults vary by shape.'
      }
    },
    required: ['model_name', 'app_prefix', 'firebase_package']
  }
};

// MARK: Input validation
const ScaffoldArgsType = type({
  model_name: 'string',
  app_prefix: 'string',
  firebase_package: 'string',
  'shape?': "'root' | 'root-singleton' | 'sub-collection' | 'singleton-sub' | 'system-state'",
  'collections_class?': 'string',
  'collection_accessor?': 'string',
  'factory_accessor?': 'string',
  'group_accessor?': 'string',
  'parent_model?': {
    name: 'string',
    'document_type?': 'string'
  },
  'system_state_type_const?': 'string',
  'data_type?': 'string',
  'functions_class?': 'string',
  'create_function?': {
    name: 'string',
    functions_path: 'string'
  },
  'crud_functions?': type({
    name: 'string',
    kind: "'create' | 'update' | 'crud'",
    functions_path: 'string'
  }).array(),
  'file_base_name?': 'string',
  'surfaces?': "('document' | 'collection')[]"
});

interface ParsedParentModel {
  readonly name: string;
  readonly documentType: string;
}

interface ParsedCrudFunction {
  readonly name: string;
  readonly kind: CrudKind;
  readonly functionsPath: string;
}

interface ParsedScaffoldArgs {
  readonly modelName: string;
  readonly modelCamel: string;
  readonly appPrefixCamel: string;
  readonly appPrefixPascal: string;
  readonly firebasePackage: string;
  readonly shape: StoreShape;
  readonly profile: ShapeProfile;
  readonly collectionsClass?: string;
  readonly collectionAccessor: string;
  readonly factoryAccessor: string;
  readonly groupAccessor: string;
  readonly parentModel?: ParsedParentModel;
  readonly systemStateTypeConst?: string;
  readonly dataType?: string;
  readonly functionsClass?: string;
  readonly crudFunctions: readonly ParsedCrudFunction[];
  readonly fileBaseName: string;
  readonly surfaces: readonly Surface[];
}

function requireString(value: string | undefined, label: string): string {
  if (value === undefined) {
    throw new Error(`Invalid arguments: ${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid arguments: ${label} must not be empty.`);
  }
  return trimmed;
}

function parseArgs(raw: unknown): ParsedScaffoldArgs {
  const parsed = ScaffoldArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }

  const modelName = requireString(parsed.model_name, 'model_name');
  const appPrefix = requireString(parsed.app_prefix, 'app_prefix');
  const firebasePackage = requireString(parsed.firebase_package, 'firebase_package');
  const shape: StoreShape = parsed.shape ?? 'root';
  const profile = SHAPE_PROFILES[shape];

  const modelCamel = camelCase(modelName);
  const appPrefixCamel = camelCase(appPrefix);
  const appPrefixPascal = pascalCase(appPrefix);

  let collectionsClass: string | undefined;
  if (profile.requiresCollectionsClass) {
    collectionsClass = requireString(parsed.collections_class, 'collections_class');
  } else if (parsed.collections_class !== undefined) {
    const trimmed = parsed.collections_class.trim();
    collectionsClass = trimmed.length > 0 ? trimmed : undefined;
  }

  const collectionAccessor = (parsed.collection_accessor ?? '').trim() || `${modelCamel}Collection`;
  const factoryAccessor = (parsed.factory_accessor ?? '').trim() || `${modelCamel}CollectionFactory`;
  const groupAccessor = (parsed.group_accessor ?? '').trim() || `${modelCamel}CollectionGroup`;

  let parentModel: ParsedParentModel | undefined;
  if (profile.hasParent) {
    if (parsed.parent_model === undefined) {
      throw new Error(`Invalid arguments: parent_model is required for shape="${shape}".`);
    }
    const parentName = requireString(parsed.parent_model.name, 'parent_model.name');
    const documentType = (parsed.parent_model.document_type ?? '').trim() || `${parentName}Document`;
    parentModel = { name: parentName, documentType };
  } else if (parsed.parent_model !== undefined) {
    throw new Error(`Invalid arguments: parent_model is only valid for shape="sub-collection" or shape="singleton-sub".`);
  }

  let systemStateTypeConst: string | undefined;
  let dataType: string | undefined;
  if (profile.requiresSystemStateTypeConst) {
    systemStateTypeConst = requireString(parsed.system_state_type_const, 'system_state_type_const');
    dataType = requireString(parsed.data_type, 'data_type');
  } else {
    if (parsed.system_state_type_const !== undefined) {
      throw new Error(`Invalid arguments: system_state_type_const is only valid for shape="system-state".`);
    }
    if (parsed.data_type !== undefined) {
      throw new Error(`Invalid arguments: data_type is only valid for shape="system-state".`);
    }
  }

  const functionsClassRaw = parsed.functions_class !== undefined ? parsed.functions_class.trim() : '';
  const functionsClass = functionsClassRaw.length > 0 ? functionsClassRaw : undefined;

  const crudFunctions: ParsedCrudFunction[] = [];
  if (parsed.crud_functions !== undefined) {
    if (functionsClass === undefined) {
      throw new Error('Invalid arguments: crud_functions requires functions_class.');
    }
    for (const cf of parsed.crud_functions) {
      const name = requireString(cf.name, 'crud_functions[].name');
      const path = requireString(cf.functions_path, 'crud_functions[].functions_path');
      crudFunctions.push({ name, kind: cf.kind, functionsPath: path });
    }
  }
  if (parsed.create_function !== undefined) {
    if (functionsClass === undefined) {
      throw new Error('Invalid arguments: create_function requires functions_class.');
    }
    const name = requireString(parsed.create_function.name, 'create_function.name');
    const path = requireString(parsed.create_function.functions_path, 'create_function.functions_path');
    crudFunctions.push({ name, kind: 'create', functionsPath: path });
  }

  const fileBaseName = (parsed.file_base_name ?? '').trim() || modelName.toLowerCase();

  const surfacesInput = parsed.surfaces ?? profile.defaultSurfaces;
  const surfaceSet = new Set<Surface>(surfacesInput);
  if (surfaceSet.size === 0) {
    throw new Error(`Invalid arguments: surfaces must include at least one of "document" or "collection".`);
  }
  for (const s of surfaceSet) {
    if (!profile.allowedSurfaces.includes(s)) {
      throw new Error(`Invalid arguments: shape="${shape}" does not support surface "${s}".`);
    }
  }
  const surfaces: readonly Surface[] = (['document', 'collection'] as const).filter((s) => surfaceSet.has(s));

  const result: ParsedScaffoldArgs = {
    modelName,
    modelCamel,
    appPrefixCamel,
    appPrefixPascal,
    firebasePackage,
    shape,
    profile,
    collectionsClass,
    collectionAccessor,
    factoryAccessor,
    groupAccessor,
    parentModel,
    systemStateTypeConst,
    dataType,
    functionsClass,
    crudFunctions,
    fileBaseName,
    surfaces
  };
  return result;
}

// MARK: Naming helpers
function camelCase(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function pascalCase(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function functionsFieldName(functionsClass: string): string {
  return camelCase(functionsClass);
}

function crudFunctionHelperName(kind: CrudKind): string {
  let result: string;
  if (kind === 'create') {
    result = 'firebaseDocumentStoreCreateFunction';
  } else if (kind === 'update') {
    result = 'firebaseDocumentStoreUpdateFunction';
  } else {
    result = 'firebaseDocumentStoreCrudFunction';
  }
  return result;
}

// MARK: File body builders
interface FileBlock {
  readonly path: string;
  readonly body: string;
}

function joinUnique(values: readonly string[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      ordered.push(v);
    }
  }
  return ordered.join(', ');
}

function renderCrudLines(args: ParsedScaffoldArgs, storeRef: string): readonly string[] {
  const lines: string[] = [];
  if (args.functionsClass !== undefined && args.crudFunctions.length > 0) {
    const field = functionsFieldName(args.functionsClass);
    for (const cf of args.crudFunctions) {
      const helper = crudFunctionHelperName(cf.kind);
      const ref = `this.${field}.${cf.functionsPath}`;
      if (cf.kind === 'crud') {
        lines.push(`  readonly ${cf.name} = ${helper}(${ref});`);
      } else {
        lines.push(`  readonly ${cf.name} = ${helper}(${storeRef}, ${ref});`);
      }
    }
  }
  return lines;
}

function renderCrudHelperImports(args: ParsedScaffoldArgs): readonly string[] {
  const helpers = new Set<string>();
  for (const cf of args.crudFunctions) {
    helpers.add(crudFunctionHelperName(cf.kind));
  }
  return Array.from(helpers).sort((a, b) => a.localeCompare(b));
}

function rootDocumentStoreBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}DocumentStore`;
  const baseClass = args.shape === 'root-singleton' ? 'AbstractRootSingleItemDbxFirebaseDocument' : 'AbstractDbxFirebaseDocumentStore';
  const collections = args.collectionsClass as string;

  const dbxFirebaseImports = [baseClass, ...renderCrudHelperImports(args)];
  const packageImports = [collections, `type ${args.modelName}`, `type ${docType}`];
  if (args.functionsClass !== undefined) {
    packageImports.push(args.functionsClass);
  }

  const lines: string[] = [];
  lines.push(`import { Injectable, inject } from '@angular/core';`);
  lines.push(`import { ${joinUnique(dbxFirebaseImports)} } from '@dereekb/dbx-firebase';`);
  lines.push(`import { ${joinUnique(packageImports)} } from '${args.firebasePackage}';`);
  lines.push('');
  lines.push(`@Injectable()`);
  lines.push(`export class ${storeClass} extends ${baseClass}<${args.modelName}, ${docType}> {`);
  if (args.functionsClass !== undefined) {
    lines.push(`  readonly ${functionsFieldName(args.functionsClass)} = inject(${args.functionsClass});`);
    lines.push('');
  }
  lines.push(`  constructor() {`);
  lines.push(`    super({ firestoreCollection: inject(${collections}).${args.collectionAccessor} });`);
  lines.push(`  }`);
  const crudLines = renderCrudLines(args, 'this');
  if (crudLines.length > 0) {
    lines.push('');
    for (const cl of crudLines) {
      lines.push(cl);
    }
  }
  lines.push(`}`);

  return { path: `${args.fileBaseName}.document.store.ts`, body: lines.join('\n') };
}

function rootCollectionStoreBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}CollectionStore`;
  const collections = args.collectionsClass as string;

  const lines: string[] = [];
  lines.push(`import { Injectable, inject } from '@angular/core';`);
  lines.push(`import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';`);
  lines.push(`import { ${collections}, type ${args.modelName}, type ${docType} } from '${args.firebasePackage}';`);
  lines.push('');
  lines.push(`@Injectable()`);
  lines.push(`export class ${storeClass} extends AbstractDbxFirebaseCollectionStore<${args.modelName}, ${docType}> {`);
  lines.push(`  constructor() {`);
  lines.push(`    super({ firestoreCollection: inject(${collections}).${args.collectionAccessor} });`);
  lines.push(`  }`);
  lines.push(`}`);

  return { path: `${args.fileBaseName}.collection.store.ts`, body: lines.join('\n') };
}

function subDocumentStoreBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}DocumentStore`;
  const baseClass = args.shape === 'singleton-sub' ? 'AbstractSingleItemDbxFirebaseDocument' : 'AbstractDbxFirebaseDocumentWithParentStore';
  const collections = args.collectionsClass as string;
  const parent = args.parentModel as ParsedParentModel;
  const parentStore = `${parent.name}DocumentStore`;
  const parentBaseFile = parent.name.toLowerCase();

  const dbxFirebaseImports = [baseClass, ...renderCrudHelperImports(args)];
  const packageImports = [collections, `type ${args.modelName}`, `type ${docType}`, `type ${parent.name}`, `type ${parent.documentType}`];
  if (args.functionsClass !== undefined) {
    packageImports.push(args.functionsClass);
  }

  const lines: string[] = [];
  lines.push(`import { Injectable, inject } from '@angular/core';`);
  lines.push(`import { ${joinUnique(dbxFirebaseImports)} } from '@dereekb/dbx-firebase';`);
  lines.push(`import { ${joinUnique(packageImports)} } from '${args.firebasePackage}';`);
  lines.push(`import { ${parentStore} } from './${parentBaseFile}.document.store';`);
  lines.push('');
  lines.push(`@Injectable()`);
  lines.push(`export class ${storeClass} extends ${baseClass}<${args.modelName}, ${parent.name}, ${docType}, ${parent.documentType}> {`);
  if (args.functionsClass !== undefined) {
    lines.push(`  readonly ${functionsFieldName(args.functionsClass)} = inject(${args.functionsClass});`);
    lines.push('');
  }
  lines.push(`  constructor() {`);
  lines.push(`    const collections = inject(${collections});`);
  lines.push(`    super({ collectionFactory: collections.${args.factoryAccessor}, firestoreCollectionLike: collections.${args.groupAccessor} });`);
  lines.push(`    const parent = inject(${parentStore}, { optional: true });`);
  lines.push('');
  lines.push(`    if (parent) {`);
  lines.push(`      this.setParentStore(parent);`);
  lines.push(`    }`);
  lines.push(`  }`);
  const crudLines = renderCrudLines(args, 'this');
  if (crudLines.length > 0) {
    lines.push('');
    for (const cl of crudLines) {
      lines.push(cl);
    }
  }
  lines.push(`}`);

  return { path: `${args.fileBaseName}.document.store.ts`, body: lines.join('\n') };
}

function subCollectionStoreBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}CollectionStore`;
  const collections = args.collectionsClass as string;
  const parent = args.parentModel as ParsedParentModel;
  const parentStore = `${parent.name}DocumentStore`;
  const parentBaseFile = parent.name.toLowerCase();

  const lines: string[] = [];
  lines.push(`import { Injectable, inject } from '@angular/core';`);
  lines.push(`import { AbstractDbxFirebaseCollectionWithParentStore } from '@dereekb/dbx-firebase';`);
  lines.push(`import { ${collections}, type ${args.modelName}, type ${docType}, type ${parent.name}, type ${parent.documentType} } from '${args.firebasePackage}';`);
  lines.push(`import { ${parentStore} } from './${parentBaseFile}.document.store';`);
  lines.push('');
  lines.push(`@Injectable()`);
  lines.push(`export class ${storeClass} extends AbstractDbxFirebaseCollectionWithParentStore<${args.modelName}, ${parent.name}, ${docType}, ${parent.documentType}> {`);
  lines.push(`  constructor() {`);
  lines.push(`    const collections = inject(${collections});`);
  lines.push(`    super({ collectionFactory: collections.${args.factoryAccessor}, collectionGroup: collections.${args.groupAccessor} });`);
  lines.push(`    const parent = inject(${parentStore}, { optional: true });`);
  lines.push('');
  lines.push(`    if (parent) {`);
  lines.push(`      this.setParentStore(parent);`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);

  return { path: `${args.fileBaseName}.collection.store.ts`, body: lines.join('\n') };
}

function systemStateAccessorBody(args: ParsedScaffoldArgs): FileBlock {
  const accessorClass = `${args.appPrefixPascal}${args.modelName}SystemStateDocumentStoreAccessor`;
  const dataType = args.dataType as string;
  const typeConst = args.systemStateTypeConst as string;

  const dbxFirebaseImports = ['AbstractSystemStateDocumentStoreAccessor', ...renderCrudHelperImports(args)];
  const packageImports = [typeConst, `type ${dataType}`];
  if (args.functionsClass !== undefined) {
    packageImports.push(args.functionsClass);
  }

  const lines: string[] = [];
  lines.push(`import { Injectable, inject } from '@angular/core';`);
  lines.push(`import { ${joinUnique(dbxFirebaseImports)} } from '@dereekb/dbx-firebase';`);
  lines.push(`import { ${joinUnique(packageImports)} } from '${args.firebasePackage}';`);
  lines.push('');
  lines.push(`@Injectable()`);
  lines.push(`export class ${accessorClass} extends AbstractSystemStateDocumentStoreAccessor<${dataType}> {`);
  if (args.functionsClass !== undefined) {
    lines.push(`  readonly ${functionsFieldName(args.functionsClass)} = inject(${args.functionsClass});`);
    lines.push('');
  }
  lines.push(`  constructor() {`);
  lines.push(`    super(${typeConst});`);
  lines.push(`  }`);
  const crudLines = renderCrudLines(args, 'this.systemStateDocumentStore');
  if (crudLines.length > 0) {
    lines.push('');
    for (const cl of crudLines) {
      lines.push(cl);
    }
  }
  lines.push(`}`);

  return { path: `${args.fileBaseName}.store.accessor.ts`, body: lines.join('\n') };
}

function documentDirectiveBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}DocumentStore`;
  const directiveClass = `${args.appPrefixPascal}${args.modelName}DocumentStoreDirective`;
  const selector = `[${args.appPrefixCamel}${args.modelName}Document]`;

  const lines: string[] = [];
  lines.push(`import { Directive, inject } from '@angular/core';`);
  lines.push(`import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';`);
  lines.push(`import { type ${args.modelName}, type ${docType} } from '${args.firebasePackage}';`);
  lines.push(`import { ${storeClass} } from './${args.fileBaseName}.document.store';`);
  lines.push('');
  lines.push(`@Directive({`);
  lines.push(`  selector: '${selector}',`);
  lines.push(`  providers: provideDbxFirebaseDocumentStoreDirective(${directiveClass}, ${storeClass}),`);
  lines.push(`  standalone: true`);
  lines.push(`})`);
  lines.push(`export class ${directiveClass} extends DbxFirebaseDocumentStoreDirective<${args.modelName}, ${docType}, ${storeClass}> {`);
  lines.push(`  constructor() {`);
  lines.push(`    super(inject(${storeClass}));`);
  lines.push(`  }`);
  lines.push(`}`);

  return { path: `${args.fileBaseName}.document.store.directive.ts`, body: lines.join('\n') };
}

function collectionDirectiveBody(args: ParsedScaffoldArgs): FileBlock {
  const docType = `${args.modelName}Document`;
  const storeClass = `${args.modelName}CollectionStore`;
  const directiveClass = `${args.appPrefixPascal}${args.modelName}CollectionStoreDirective`;
  const selector = `[${args.appPrefixCamel}${args.modelName}Collection]`;

  const lines: string[] = [];
  lines.push(`import { Directive, inject } from '@angular/core';`);
  lines.push(`import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';`);
  lines.push(`import { type ${args.modelName}, type ${docType} } from '${args.firebasePackage}';`);
  lines.push(`import { ${storeClass} } from './${args.fileBaseName}.collection.store';`);
  lines.push('');
  lines.push(`@Directive({`);
  lines.push(`  selector: '${selector}',`);
  lines.push(`  providers: provideDbxFirebaseCollectionStoreDirective(${directiveClass}, ${storeClass}),`);
  lines.push(`  standalone: true`);
  lines.push(`})`);
  lines.push(`export class ${directiveClass} extends DbxFirebaseCollectionStoreDirective<${args.modelName}, ${docType}, ${storeClass}> {`);
  lines.push(`  constructor() {`);
  lines.push(`    super(inject(${storeClass}));`);
  lines.push(`  }`);
  lines.push(`}`);

  return { path: `${args.fileBaseName}.collection.store.directive.ts`, body: lines.join('\n') };
}

function buildBlocks(args: ParsedScaffoldArgs): readonly FileBlock[] {
  const blocks: FileBlock[] = [];

  if (args.shape === 'system-state') {
    blocks.push(systemStateAccessorBody(args));
  } else {
    for (const surface of args.surfaces) {
      if (surface === 'document') {
        if (args.shape === 'sub-collection' || args.shape === 'singleton-sub') {
          blocks.push(subDocumentStoreBody(args));
        } else {
          blocks.push(rootDocumentStoreBody(args));
        }
        if (args.profile.emitsDirectives) {
          blocks.push(documentDirectiveBody(args));
        }
      } else {
        if (args.shape === 'sub-collection') {
          blocks.push(subCollectionStoreBody(args));
        } else {
          blocks.push(rootCollectionStoreBody(args));
        }
        if (args.profile.emitsDirectives) {
          blocks.push(collectionDirectiveBody(args));
        }
      }
    }
  }
  return blocks;
}

// MARK: Output
function formatScaffold(args: ParsedScaffoldArgs): string {
  const blocks = buildBlocks(args);
  const lines: string[] = [];
  lines.push(`# ${args.modelName} store scaffold`);
  lines.push('');
  const surfaceLabel = args.shape === 'system-state' ? 'accessor' : args.surfaces.join(' + ');
  const functionsLabel = args.functionsClass ?? 'none';
  const crudLabel = args.crudFunctions.length > 0 ? args.crudFunctions.map((c) => `${c.name} (${c.kind})`).join(', ') : 'none';
  const parentLabel = args.parentModel !== undefined ? args.parentModel.name : 'n/a';
  lines.push(`Shape: \`${args.shape}\` · Surfaces: ${surfaceLabel} · Parent: ${parentLabel} · Functions: ${functionsLabel} · Crud: ${crudLabel}`);
  lines.push('');
  lines.push(`Drop into \`<app>/src/lib/modules/${args.fileBaseName.replaceAll('.', '/')}/store/\`.`);
  lines.push('');

  for (const block of blocks) {
    lines.push(`## \`${block.path}\``);
    lines.push('');
    lines.push('```ts');
    lines.push(block.body);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Notes');
  lines.push('');
  lines.push('- Each store is `@Injectable()` with no `providedIn` — wire it in the consuming feature module / route providers, alongside its directive (when present).');
  if (args.shape === 'sub-collection' || args.shape === 'singleton-sub') {
    lines.push(`- The \`${args.parentModel?.name}DocumentStore\` parent is injected with \`{ optional: true }\` so the store works both as a standalone and as a child of a parent's document directive.`);
  }
  if (args.shape === 'system-state') {
    lines.push(`- The accessor wraps a shared \`SystemStateDocumentStore\` keyed by \`${args.systemStateTypeConst}\`. CRUD function helpers reference \`this.systemStateDocumentStore\` (not \`this\`).`);
  }
  if (args.crudFunctions.length > 0) {
    lines.push(`- ${args.crudFunctions.length} CRUD helper line${args.crudFunctions.length === 1 ? '' : 's'} wired through \`firebaseDocumentStore{Create,Update,Crud}Function\`.`);
  }
  lines.push('- → See `dbx_model_lookup topic="shapes"` for the full store-shape taxonomy.');
  lines.push('- → Skill: `dbx__guide__angular-stores`.');

  return lines.join('\n');
}

// MARK: Handler
/**
 * Handler for the `dbx_model_store_scaffold` MCP tool. Validates inputs and
 * returns the multi-block markdown scaffold; never throws.
 *
 * @param rawArgs - Raw `tools/call` argument payload, validated against the schema.
 * @returns A {@link ToolResult} containing the markdown scaffold or an `Invalid arguments` error.
 */
export function runModelStoreScaffold(rawArgs: unknown): ToolResult {
  let args: ParsedScaffoldArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }
  const text = formatScaffold(args);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const modelStoreScaffoldTool: DbxTool = {
  definition: DBX_MODEL_STORE_SCAFFOLD_TOOL,
  run: runModelStoreScaffold
};

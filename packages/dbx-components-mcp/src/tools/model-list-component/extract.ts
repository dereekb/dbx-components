/**
 * Extractor for `dbx_model_list_component`. Walks the model root of a
 * downstream `-firebase` component and pulls the identity surface
 * (`firestoreModelIdentity(...)` call) out of every model folder's
 * `<folder>.ts` file.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { Node, Project, type SourceFile } from 'ts-morph';
import { RESERVED_MODEL_FOLDERS } from '../model-validate-folder/types.js';
import type { ComponentModelEntry, SkippedReservedFolder } from './types.js';

const MODEL_SUBPATH = 'src/lib/model';

/**
 * Result of extracting the model surface from one component.
 */
export interface ExtractionOutcome {
  readonly modelRoot: string;
  readonly models: readonly ComponentModelEntry[];
  readonly skipped: readonly SkippedReservedFolder[];
  readonly unidentifiedFolders: readonly string[];
}

/**
 * Walks `<componentAbs>/src/lib/model/` and extracts the identity
 * surface of every non-reserved model folder. Reserved folders
 * (`system`, `notification`, `storagefile`) are returned in
 * {@link ExtractionOutcome.skipped} with their recommended dedicated
 * validator. Folders without a detectable
 * `firestoreModelIdentity(...)` call land in
 * {@link ExtractionOutcome.unidentifiedFolders}.
 *
 * @param componentAbs - absolute path to the component package root
 * @returns the extraction result (folders + models + skipped list)
 */
export async function extractComponentModels(componentAbs: string): Promise<ExtractionOutcome> {
  const modelRoot = join(componentAbs, MODEL_SUBPATH);
  const folders = await listFolders(modelRoot);
  if (folders === undefined) {
    const result: ExtractionOutcome = { modelRoot, models: [], skipped: [], unidentifiedFolders: [] };
    return result;
  }
  const reserved = new Map(RESERVED_MODEL_FOLDERS.map((r) => [r.name, r] as const));
  const skipped: SkippedReservedFolder[] = [];
  const targetFolders: string[] = [];
  for (const folder of folders) {
    const reservedEntry = reserved.get(folder);
    if (reservedEntry) {
      skipped.push({ folder, recommendedTool: reservedEntry.recommendedTool });
      continue;
    }
    targetFolders.push(folder);
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const models: ComponentModelEntry[] = [];
  const unidentified: string[] = [];

  for (const folder of targetFolders) {
    const folderAbs = join(modelRoot, folder);
    const mainFile = await readMainFile(folderAbs, folder);
    if (mainFile === undefined) {
      unidentified.push(folder);
      continue;
    }
    const sourceFile = project.createSourceFile(mainFile.fileName, mainFile.text, { overwrite: true });
    const identity = findIdentityIn(sourceFile);
    const sourceFileRel = relative(componentAbs, mainFile.absPath).split(sep).join('/');
    if (!identity) {
      unidentified.push(folder);
      continue;
    }
    models.push({
      folder,
      modelName: deriveModelName(identity.constName, folder),
      identityConst: identity.constName,
      collectionName: identity.collectionName,
      collectionPrefix: identity.collectionPrefix,
      parentIdentityConst: identity.parentIdentityRef,
      sourceFile: sourceFileRel,
      fixtureCovered: undefined
    });
  }

  models.sort((a, b) => a.folder.localeCompare(b.folder));
  skipped.sort((a, b) => a.folder.localeCompare(b.folder));
  unidentified.sort();
  const result: ExtractionOutcome = { modelRoot, models, skipped, unidentifiedFolders: unidentified };
  return result;
}

async function listFolders(modelRoot: string): Promise<readonly string[] | undefined> {
  try {
    const stats = await stat(modelRoot);
    if (!stats.isDirectory()) return undefined;
  } catch {
    return undefined;
  }
  const entries = await readdir(modelRoot, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) out.push(entry.name);
  }
  out.sort();
  return out;
}

interface MainFile {
  readonly absPath: string;
  readonly fileName: string;
  readonly text: string;
}

async function readMainFile(folderAbs: string, folder: string): Promise<MainFile | undefined> {
  const candidate = join(folderAbs, `${folder}.ts`);
  try {
    const text = await readFile(candidate, 'utf8');
    return { absPath: candidate, fileName: basename(candidate), text };
  } catch {
    return undefined;
  }
}

interface ExtractedIdentityInfo {
  readonly constName: string;
  readonly parentIdentityRef: string | undefined;
  readonly collectionName: string | undefined;
  readonly collectionPrefix: string | undefined;
}

function findIdentityIn(sourceFile: SourceFile): ExtractedIdentityInfo | undefined {
  for (const statement of sourceFile.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) continue;
      if (initializer.getExpression().getText() !== 'firestoreModelIdentity') continue;
      const args = initializer.getArguments();
      const parsed = parseIdentityArgs(args);
      const result: ExtractedIdentityInfo = {
        constName: decl.getName(),
        parentIdentityRef: parsed.parentIdentityRef,
        collectionName: parsed.collectionName,
        collectionPrefix: parsed.collectionPrefix
      };
      return result;
    }
  }
  return undefined;
}

function parseIdentityArgs(args: readonly Node[]): { parentIdentityRef: string | undefined; collectionName: string | undefined; collectionPrefix: string | undefined } {
  if (args.length === 2) {
    return { parentIdentityRef: undefined, collectionName: stringLiteralValue(args[0]), collectionPrefix: stringLiteralValue(args[1]) };
  }
  if (args.length === 3) {
    const parent = Node.isIdentifier(args[0]) ? args[0].getText() : undefined;
    return { parentIdentityRef: parent, collectionName: stringLiteralValue(args[1]), collectionPrefix: stringLiteralValue(args[2]) };
  }
  return { parentIdentityRef: undefined, collectionName: undefined, collectionPrefix: undefined };
}

function stringLiteralValue(node: Node): string | undefined {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return undefined;
}

/**
 * Derives a PascalCase model name from the identity constant. Falls
 * back to a PascalCased folder name when the const name doesn't
 * follow the `<camelName>Identity` convention.
 *
 * @param constName - the identity constant name (e.g. `profileIdentity`)
 * @param folder - the folder basename used as a fallback
 * @returns the PascalCase model name
 */
export function deriveModelName(constName: string, folder: string): string {
  const stem = constName.replace(/Identity$/, '');
  const target = stem.length > 0 ? stem : folder;
  return target.charAt(0).toUpperCase() + target.slice(1);
}

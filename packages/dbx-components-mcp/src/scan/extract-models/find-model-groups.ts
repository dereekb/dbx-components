/**
 * Locates `<X>FirestoreCollections` containers tagged with `@dbxModelGroup`
 * (either `export abstract class <X>FirestoreCollections` or
 * `export interface <X>FirestoreCollections`) and lifts the group's name
 * plus the model classes its body references.
 *
 * Mirrors `findModelGroups` + `extractGroupModelNames` in
 * `scripts/extract-firebase-models.mjs`.
 */

import { type ClassDeclaration, type InterfaceDeclaration, type JSDoc, type SourceFile } from 'ts-morph';
import { readDescription } from './find-interfaces.js';
import type { ExtractedModelGroup } from './types.js';

const CONTAINER_SUFFIX = 'FirestoreCollections';
const MODEL_NAME_RE = /\b([A-Z][A-Za-z0-9]*)FirestoreCollection(?:Factory|Group)?\b/g;

/**
 * Returns every `<X>FirestoreCollections` container in the source file
 * tagged with `@dbxModelGroup`. The group name comes from the explicit
 * tag argument; bare `@dbxModelGroup` markers fall back to the container
 * name with the `FirestoreCollections` suffix stripped.
 *
 * @param sf - the parsed source file to inspect
 * @returns the model-group containers in source order
 */
export function findModelGroups(sf: SourceFile): readonly ExtractedModelGroup[] {
  const out: ExtractedModelGroup[] = [];
  for (const decl of sf.getClasses()) {
    if (!decl.isExported() || !decl.isAbstract()) continue;
    const built = buildFromDecl(decl);
    if (built) out.push(built);
  }
  for (const decl of sf.getInterfaces()) {
    if (!decl.isExported()) continue;
    const built = buildFromDecl(decl);
    if (built) out.push(built);
  }
  return out;
}

function buildFromDecl(decl: ClassDeclaration | InterfaceDeclaration): ExtractedModelGroup | undefined {
  const name = decl.getName();
  if (!name || !name.endsWith(CONTAINER_SUFFIX)) return undefined;
  const tag = readDbxModelGroupTag(decl.getJsDocs());
  if (tag === undefined) return undefined;
  const explicitName = typeof tag === 'string' ? tag : undefined;
  const groupName = explicitName ?? name.slice(0, -CONTAINER_SUFFIX.length);
  return {
    name: groupName,
    containerName: name,
    description: readDescription(decl.getJsDocs()),
    modelNames: extractGroupModelNames(decl.getText())
  };
}

function readDbxModelGroupTag(jsDocs: readonly JSDoc[]): true | string | undefined {
  let result: true | string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== 'dbxModelGroup') continue;
      const text = tag.getCommentText()?.trim() ?? '';
      result = text.length > 0 ? text : true;
    }
  }
  return result;
}

function extractGroupModelNames(text: string): readonly string[] {
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  MODEL_NAME_RE.lastIndex = 0;
  while ((match = MODEL_NAME_RE.exec(text)) !== null) {
    seen.add(match[1]);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

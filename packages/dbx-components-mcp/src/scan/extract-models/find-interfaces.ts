/**
 * Walks every `export interface` declaration in a ts-morph source file and
 * captures the JSDoc tag flags (`@dbxModel`), `extends` references, and
 * per-property metadata (TS type, optionality, JSDoc description, and the
 * `@dbxModelVariable` long-name tag).
 *
 * Mirrors the regex-based extractor's `findInterfaces` + `parseInterfaceBody`
 * pair from `scripts/extract-firebase-models.mjs`, but the AST drops the
 * cumbersome property-by-property regex.
 */

import { type InterfaceDeclaration, type JSDoc, type SourceFile } from 'ts-morph';
import type { ExtractedInterface, ExtractedInterfaceProp } from './types.js';

/**
 * Returns every exported interface in the source file with the metadata the
 * model assembler needs. Non-exported interfaces are skipped because the
 * upstream registry only considers exported model interfaces (matching the
 * `.mjs` extractor's `export interface` regex).
 *
 * @param sf - the parsed source file to inspect
 * @returns the interfaces in source order
 */
export function findInterfaces(sf: SourceFile): readonly ExtractedInterface[] {
  const out: ExtractedInterface[] = [];
  for (const decl of sf.getInterfaces()) {
    if (!decl.isExported()) continue;
    out.push(buildInterface(decl));
  }
  return out;
}

function buildInterface(decl: InterfaceDeclaration): ExtractedInterface {
  const tags = readInterfaceTags(decl.getJsDocs());
  const description = readDescription(decl.getJsDocs());
  const extendsNames = decl.getExtends().map((e) => e.getExpression().getText());
  const props: ExtractedInterfaceProp[] = [];
  for (const prop of decl.getProperties()) {
    const propJsDocs = prop.getJsDocs();
    const propTags = readPropertyTags(propJsDocs);
    const tsType = (prop.getTypeNode()?.getText() ?? '').replaceAll(/\s+/g, ' ').trim();
    const isOptional = prop.hasQuestionToken() || tsType.startsWith('Maybe<');
    props.push({
      name: prop.getName(),
      tsType,
      optional: isOptional,
      description: readDescription(propJsDocs),
      longName: propTags.dbxModelVariable,
      syncFlag: propTags.dbxModelVariableSyncFlag
    });
  }
  return {
    name: decl.getName(),
    description,
    tags,
    extendsNames,
    props
  };
}

interface InterfaceTags {
  readonly dbxModel: boolean;
}

function readInterfaceTags(jsDocs: readonly JSDoc[]): InterfaceTags {
  let dbxModel = false;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() === 'dbxModel') {
        dbxModel = true;
      }
    }
  }
  return { dbxModel };
}

interface PropertyTags {
  readonly dbxModelVariable: string | undefined;
  readonly dbxModelVariableSyncFlag: string | undefined;
}

function readPropertyTags(jsDocs: readonly JSDoc[]): PropertyTags {
  let dbxModelVariable: string | undefined;
  let dbxModelVariableSyncFlag: string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName === 'dbxModelVariable') {
        const text = tag.getCommentText()?.trim();
        if (text !== undefined && text.length > 0 && dbxModelVariable === undefined) {
          dbxModelVariable = text;
        }
      } else if (tagName === 'dbxModelVariableSyncFlag') {
        const text = tag.getCommentText()?.trim();
        if (text !== undefined && text.length > 0 && dbxModelVariableSyncFlag === undefined) {
          dbxModelVariableSyncFlag = text;
        }
      }
    }
  }
  return { dbxModelVariable, dbxModelVariableSyncFlag };
}

/**
 * Returns the first non-empty paragraph of the leading JSDoc description.
 * Mirrors the `.mjs` `parseJsdocBlock` that splits on the first blank line
 * before the first `@`-tag.
 *
 * @param jsDocs - the JSDoc blocks attached to a declaration
 * @returns the description paragraph, or `undefined` when none exists
 */
export function readDescription(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length === 0) continue;
    const paragraph = firstParagraph(description);
    if (paragraph.length > 0) {
      result = paragraph;
      break;
    }
  }
  return result;
}

function firstParagraph(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith('@')) break;
    if (line.length === 0) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(line);
  }
  return collected.join(' ').trim();
}

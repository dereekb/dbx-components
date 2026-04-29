/**
 * Walks every exported `enum` in a ts-morph source file and captures the
 * member name, persisted value, and JSDoc description. Mirrors the `.mjs`
 * `findEnums` + `parseEnumBody` pair via the AST.
 *
 * Numeric enums auto-increment when no explicit value is supplied, matching
 * TypeScript's runtime behaviour and the upstream extractor's expectations.
 */

import { Node, SyntaxKind, type EnumDeclaration, type SourceFile } from 'ts-morph';
import { readDescription } from './find-interfaces.js';
import type { ExtractedEnum, ExtractedEnumValue } from './types.js';

/**
 * Returns every exported enum declared in the source file along with its
 * members. Enum members without an explicit initializer auto-increment
 * starting from 0 (or from the previous explicit numeric value + 1).
 *
 * @param sf - the parsed source file to inspect
 * @returns the enums in source order
 */
export function findEnums(sf: SourceFile): readonly ExtractedEnum[] {
  const out: ExtractedEnum[] = [];
  for (const decl of sf.getEnums()) {
    if (!decl.isExported()) continue;
    out.push(buildEnum(decl));
  }
  return out;
}

function buildEnum(decl: EnumDeclaration): ExtractedEnum {
  const values: ExtractedEnumValue[] = [];
  let auto = 0;
  for (const member of decl.getMembers()) {
    const initializer = member.getInitializer();
    let value: number | string;
    if (initializer === undefined) {
      value = auto;
      auto = value + 1;
    } else if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
      value = initializer.getLiteralText();
    } else if (Node.isNumericLiteral(initializer)) {
      value = Number(initializer.getLiteralText());
      auto = value + 1;
    } else if (Node.isPrefixUnaryExpression(initializer)) {
      // Handles negative numeric literals (e.g. `= -1`).
      const inner = initializer.getOperand();
      if (Node.isNumericLiteral(inner)) {
        const raw = Number(inner.getLiteralText());
        value = initializer.getOperatorToken() === SyntaxKind.MinusToken ? -raw : raw;
        auto = (value as number) + 1;
      } else {
        value = initializer.getText();
      }
    } else {
      value = initializer.getText();
    }
    values.push({ name: member.getName(), value, description: readDescription(member.getJsDocs()) });
  }
  return {
    name: decl.getName(),
    values,
    description: readDescription(decl.getJsDocs())
  };
}

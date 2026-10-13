/**
 * Description check for `dbx_model_api_validate_app`.
 *
 * A declared CRUD entry's MCP tool / CLI command description is built from two JSDoc summaries: the one on its member in
 * the `<Group>ModelCrudFunctionsConfig` type and the one on its params interface. With neither, MCP falls back to a
 * generic `Performs the "<verb>" call on the "<model>" model.` that says nothing about what the call does. This check
 * warns about every declared entry that has neither (`MISSING_DESCRIPTION`).
 */

import type { Maybe } from '@dereekb/util';
import type { DeclaredEntry, ValidateIssue } from './types.js';

/**
 * Returns a `MISSING_DESCRIPTION` warning when a declared entry has no JSDoc summary on either its
 * `<Group>ModelCrudFunctionsConfig` member or its params interface.
 *
 * @param declared - The declared CRUD entry.
 * @returns The warning, or `undefined` when the entry has a description.
 */
export function checkDeclaredDescription(declared: DeclaredEntry): Maybe<ValidateIssue> {
  let result: Maybe<ValidateIssue>;
  if (!declared.description && !declared.paramsTypeDescription) {
    const member = `\`${declared.specifier ?? declared.verb}\``;
    const source = `${declared.sourceFile}:${declared.line}`;
    const paramsClause = declared.paramsTypeName ? ` nor its params interface \`${declared.paramsTypeName}\`` : '';
    result = {
      code: 'MISSING_DESCRIPTION',
      severity: 'warning',
      model: declared.model,
      verb: declared.verb,
      specifier: declared.specifier,
      message: `Declared in \`${source}\` with no description: neither its ${member} member in the \`*ModelCrudFunctionsConfig\` type${paramsClause} has a JSDoc summary, so its MCP tool and CLI command only say that they perform the \`${declared.verb}\` call. Add a JSDoc summary above the ${member} member saying what the call does and what it acts on.`,
      source
    };
  }
  return result;
}

import { readdirSync } from 'node:fs';
import { basename, dirname, sep } from 'node:path';
import { buildCanonicalFilename, classifySpecFile } from '@dereekb/util';
import { type AstNode } from './util';
import { DEFAULT_FUNCTION_DIR_SEGMENT } from './require-canonical-api-spec-filename.rule';

/**
 * Options for the require-api-crud-spec-for-group rule.
 */
export interface FirebaseRequireApiCrudSpecForGroupRuleOptions {
  /**
   * Path-suffix marker that anchors the rule to API function folders.
   * Defaults to `'src/app/function'`. Files outside this segment are ignored.
   */
  readonly functionDirSegment?: string;
}

/**
 * ESLint rule definition for require-api-crud-spec-for-group.
 */
export interface FirebaseRequireApiCrudSpecForGroupRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireApiCrudSpecForGroupRuleOptions[]; filename: string; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

function isGroupIndex(filename: string, functionDirSegment: string): boolean {
  const normalized = filename.split(sep).join('/');
  const marker = `/${functionDirSegment}/`;
  const markerIdx = normalized.indexOf(marker);
  let result = false;
  if (markerIdx >= 0) {
    const afterMarker = normalized.slice(markerIdx + marker.length);
    const parts = afterMarker.split('/');
    result = parts.length === 2 && parts[1] === 'index.ts';
  }
  return result;
}

function hasCrudSpec(groupDir: string, group: string): boolean {
  let found = false;
  try {
    const entries = readdirSync(groupDir);
    for (const entry of entries) {
      const classification = classifySpecFile({ filename: entry, parentFolderName: group });
      if (classification.kind === 'crud' || classification.kind === 'crud-subgroup') {
        found = true;
        break;
      }
    }
  } catch {
    // Directory unreadable — treat as no crud spec; rule will emit the warning
    // and the user can investigate. We do NOT swallow the error silently
    // in any other way.
  }
  return found;
}

/**
 * ESLint rule that fires on every `<apiDir>/src/app/function/<group>/index.ts`
 * (the canonical anchor file for a Firebase Functions group) and verifies
 * that the same folder contains a `<group>.crud.spec.ts` (or any
 * `<group>.crud.<sub>.spec.ts` variant) sibling. Mirrors the coverage check
 * in `dbx_model_test_validate_app` so editor + CI lint flag missing CRUD
 * coverage without needing the MCP audit.
 *
 * Not auto-fixable: creating a spec file shell with sensible test cases is
 * outside the safe scope of an ESLint autofix.
 */
export const FIREBASE_REQUIRE_API_CRUD_SPEC_FOR_GROUP_RULE: FirebaseRequireApiCrudSpecForGroupRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require every API model-group function folder to have a `<group>.crud.spec.ts` covering its CRUD function map.',
      recommended: true
    },
    messages: {
      modelGroupMissingCrudSpec: 'Model group `{{group}}` has no `{{expectedFilename}}`. Add it covering the CRUD function map (create/read/update/delete + permission/error paths).'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          functionDirSegment: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const functionDirSegment = options.functionDirSegment ?? DEFAULT_FUNCTION_DIR_SEGMENT;
    const filename = context.filename;
    const isAnchor = isGroupIndex(filename, functionDirSegment);

    function check(programNode: AstNode): void {
      if (!isAnchor) return;
      const groupDir = dirname(filename);
      const group = basename(groupDir);
      if (hasCrudSpec(groupDir, group)) return;
      const expectedFilename = buildCanonicalFilename({ group, bucket: 'crud', subgroups: [] });
      context.report({
        node: programNode,
        messageId: 'modelGroupMissingCrudSpec',
        data: { group, expectedFilename }
      });
    }

    return {
      Program: (node: AstNode) => check(node)
    };
  }
};

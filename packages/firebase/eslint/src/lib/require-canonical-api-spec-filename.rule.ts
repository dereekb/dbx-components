import { basename, dirname, sep } from 'node:path';
import { classifySpecFile, type Maybe } from '@dereekb/util';
import { type AstNode } from './util';

/**
 * Default subpath segment (relative to an app source root) below which the
 * rule expects model-group function folders. Matches the convention used by
 * `<apiDir>/src/app/function/<group>/`.
 */
export const DEFAULT_FUNCTION_DIR_SEGMENT = 'src/app/function';

/**
 * Options for the require-canonical-api-spec-filename rule.
 */
export interface FirebaseRequireCanonicalApiSpecFilenameRuleOptions {
  /**
   * Path-suffix marker that anchors the rule to API function folders.
   * Defaults to `'src/app/function'`. Any `.spec.ts` whose path contains
   * `<marker>/<group>/<filename>` is classified; everything else is ignored.
   */
  readonly functionDirSegment?: string;
}

/**
 * ESLint rule definition for require-canonical-api-spec-filename.
 */
export interface FirebaseRequireCanonicalApiSpecFilenameRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireCanonicalApiSpecFilenameRuleOptions[]; filename: string; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

interface MatchedSpec {
  readonly filename: string;
  readonly parentFolderName: string;
}

function matchFunctionSpecPath(filename: string, functionDirSegment: string): Maybe<MatchedSpec> {
  let result: Maybe<MatchedSpec>;
  if (filename.endsWith('.spec.ts')) {
    const normalized = filename.split(sep).join('/');
    const marker = `/${functionDirSegment}/`;
    const markerIdx = normalized.indexOf(marker);
    if (markerIdx >= 0) {
      const afterMarker = normalized.slice(markerIdx + marker.length);
      const parts = afterMarker.split('/');
      if (parts.length === 2) {
        result = { filename: parts[1] ?? '', parentFolderName: parts[0] ?? '' };
      } else if (parts.length > 2) {
        result = { filename: basename(filename), parentFolderName: basename(dirname(filename)) };
      }
    }
  }
  return result;
}

/**
 * ESLint rule that enforces the canonical naming convention for Firebase
 * Functions API spec files: every `.spec.ts` under
 * `<apiDir>/src/app/function/<group>/` must be `<group>.crud[.<sub>...].spec.ts`
 * or `<group>.scenario[.<sub>...].spec.ts`. Drift forms surface a rename
 * suggestion derived from the shared `classifySpecFile` classifier in
 * `@dereekb/util`, so this rule and the `dbx_model_test_validate_app` MCP
 * tool never diverge.
 *
 * Not auto-fixable: renaming files (and updating any imports/snapshots they
 * carry) is outside the safe scope of an ESLint autofix.
 */
export const FIREBASE_REQUIRE_CANONICAL_API_SPEC_FILENAME_RULE: FirebaseRequireCanonicalApiSpecFilenameRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require API spec filenames under `src/app/function/<group>/` to follow the `<group>.crud[.<sub>...].spec.ts` / `<group>.scenario[.<sub>...].spec.ts` convention.',
      recommended: true
    },
    messages: {
      testFileDriftRename: '`{{filename}}`: {{reason}} Rename to `{{recommendedRename}}`.',
      testFileMissingBucket: '`{{filename}}`: missing `crud` / `scenario` segment. Rename to `{{recommendedRename}}` (default) or to a `crud` variant if the tests are CRUD-flavored.',
      testFileNonGroupPlacement: '`{{filename}}`: first segment `{{group}}` does not match the parent folder `{{parentFolderName}}`. Move into `{{group}}/` or rename the prefix to match the current folder.'
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

    const matched = matchFunctionSpecPath(context.filename, functionDirSegment);

    function check(programNode: AstNode): void {
      if (!matched) return;
      const classification = classifySpecFile({ filename: matched.filename, parentFolderName: matched.parentFolderName });
      if (classification.isCanonical) return;
      if (classification.kind === 'non-spec') return;

      if (classification.kind === 'crud-misplaced' || classification.kind === 'scenario-misplaced') {
        context.report({
          node: programNode,
          messageId: 'testFileDriftRename',
          data: {
            filename: classification.filename,
            reason: classification.driftReason ?? 'segment order does not match the convention.',
            recommendedRename: classification.recommendedRename ?? ''
          }
        });
      } else if (classification.kind === 'no-bucket') {
        context.report({
          node: programNode,
          messageId: 'testFileMissingBucket',
          data: {
            filename: classification.filename,
            recommendedRename: classification.recommendedRename ?? ''
          }
        });
      } else if (classification.kind === 'non-group') {
        context.report({
          node: programNode,
          messageId: 'testFileNonGroupPlacement',
          data: {
            filename: classification.filename,
            group: classification.group,
            parentFolderName: matched.parentFolderName
          }
        });
      }
    }

    return {
      Program: (node: AstNode) => check(node)
    };
  }
};

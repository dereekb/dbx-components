/**
 * Firestore-rules MCP resources.
 *
 * Exposes the per-collection read posture derived from a workspace's `firestore.rules` as read-only
 * resources, for clients that prefer browsing data over calling `dbx_firestore_rules_scan`.
 *
 * Unlike the registry-backed resources in this folder, there is no pre-loaded catalog: the rules file
 * is READ AT REQUEST TIME off the server cwd, so the answer always reflects the file on disk rather
 * than whatever was true at server bootstrap. Rules files change under review and a stale posture is
 * worse than no posture — this is the artifact the model-level server-only gate is derived from.
 *
 * Also publishes a reference document explaining the three access values and the `serverOnly`
 * derivation, so a consumer does not have to infer the semantics from the data.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { firestoreRulesAccessForCollection, scanFirestoreRules, type FirestoreRulesScan } from '@dereekb/dbx-cli/firestore-rules';
import { pickFirstVariable } from './_resource-helpers.js';

const CATALOG_URI = 'dbx://firestore-rules/collections';
const REFERENCE_URI = 'dbx://firestore-rules/reference';
const BY_COLLECTION_TEMPLATE = 'dbx://firestore-rules/collections/{collection}';

const DEFAULT_RULES_FILE = 'firestore.rules';

const REFERENCE_TEXT = [
  '# Client read posture, as written in `firestore.rules`',
  '',
  'Per collection, per operation (`get` / `list`):',
  '',
  '| Value | Meaning |',
  '|---|---|',
  '| `allowed` | Some `allow` covering the op has a condition that is not constant-`false`. |',
  '| `denied` | The op is covered only by `allow`s whose condition is literally `false` — a written-down refusal. |',
  '| `unmatched` | No `allow` covers the op. Firestore default-deny applies — the refusal is an absence. |',
  '',
  '`denied` and `unmatched` are both refusals; they are kept distinct because they mean different things to a reviewer.',
  '',
  '## `serverOnly`',
  '',
  'True when **neither** `get` nor `list` is `allowed`. No client can read the model on any path, so:',
  '',
  '- the model interface should carry `@dbxModelServerOnly`,',
  '- the `firebaseModelServiceFactory` config should carry `serverOnly: true`, and',
  '- `ModelApiGetService` refuses the read with `MODEL_IS_SERVER_ONLY` instead of authorizing it via `roleMapForModel` under the Admin SDK.',
  '',
  'Run `dbx_model_server_only_validate_app` to check that all three agree.',
  '',
  '## `get` allowed, `list` not',
  '',
  'The collection is readable by id but **not queryable**. `firestore-get` works; `firestore-query` is rejected at the rules layer.',
  '',
  '## Scanner scope',
  '',
  'The scanner is not a CEL evaluator. It reads match nesting, `{var}` / `{path=**}` wildcard segments, and constant-`false` conditions; every other condition reads as `allowed`. The verdict is therefore a **lower bound** on what the real rules refuse — safe for a gate whose false-negative is "let the real rules decide".',
  '',
  '`apps/demo-api/src/test/tests/firestore.rules.spec.ts` remains the dynamic oracle: it drives the real rules engine via `@firebase/rules-unit-testing`.'
].join('\n');

/**
 * Input to {@link registerFirestoreRulesResource}.
 */
export interface RegisterFirestoreRulesResourceOptions {
  /**
   * Directory the rules file is resolved against. Defaults to `process.cwd()` (the workspace root)
   * at request time, matching how the `*_validate_app` tools resolve their inputs.
   */
  readonly cwd?: string;
  /**
   * Path of the rules file relative to {@link cwd}. Defaults to `firestore.rules`.
   */
  readonly rulesFile?: string;
}

/**
 * Registers the firestore-rules MCP resources (the per-collection catalog, a per-collection detail
 * template that synthesizes the `unmatched` verdict for a collection the file never names, and the
 * semantics reference).
 *
 * @param server - The MCP server to register resources against.
 * @param options - Optional cwd / rules-file overrides.
 */
export function registerFirestoreRulesResource(server: McpServer, options: RegisterFirestoreRulesResourceOptions = {}): void {
  const rulesFile = options.rulesFile ?? DEFAULT_RULES_FILE;

  async function loadScan(): Promise<{ readonly scan?: FirestoreRulesScan; readonly error?: string }> {
    const cwd = options.cwd ?? process.cwd();
    let result: { readonly scan?: FirestoreRulesScan; readonly error?: string };

    try {
      result = { scan: scanFirestoreRules(await readFile(resolve(cwd, rulesFile), 'utf8')) };
    } catch (e) {
      result = { error: `Failed to read ${rulesFile}: ${e instanceof Error ? e.message : String(e)}` };
    }

    return result;
  }

  server.registerResource(
    'dbx-components Firestore Rules Collections',
    CATALOG_URI,
    {
      title: 'Firestore Rules Collections',
      description: 'Per-collection client read posture (`get` / `list` → allowed | denied | unmatched) derived from the workspace `firestore.rules`, plus the `serverOnly` verdict.',
      mimeType: 'application/json'
    },
    async () => {
      const { scan, error } = await loadScan();

      return {
        contents: [
          {
            uri: CATALOG_URI,
            mimeType: scan ? 'application/json' : 'text/plain',
            text: scan ? JSON.stringify({ rulesFile, collections: scan.collections, serverOnly: scan.collections.filter((x) => x.serverOnly).map((x) => x.collection) }, null, 2) : (error ?? 'Failed to read the rules file.')
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firestore Rules Collection Detail',
    new ResourceTemplate(BY_COLLECTION_TEMPLATE, { list: undefined }),
    {
      title: 'Firestore Rules Collection Detail',
      description: 'Read posture for one short collection name (e.g. `gb`, `sys`). A collection the rules file never names resolves to `unmatched` / server-only rather than a miss.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const collection = pickFirstVariable(variables['collection']);
      const { scan, error } = await loadScan();
      let text: string;
      let json = false;

      if (scan == null) {
        text = error ?? 'Failed to read the rules file.';
      } else if (collection === undefined || collection.length === 0) {
        text = `No collection provided. Known collections: ${scan.collections.map((x) => x.collection).join(', ')}`;
      } else {
        json = true;
        text = JSON.stringify({ rulesFile, ...firestoreRulesAccessForCollection(scan, collection) }, null, 2);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: json ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firestore Rules Reference',
    REFERENCE_URI,
    {
      title: 'Firestore Rules Read-Posture Reference',
      description: "What allowed / denied / unmatched mean, how `serverOnly` is derived, and the scanner's deliberate limits.",
      mimeType: 'text/markdown'
    },
    async () => ({
      contents: [
        {
          uri: REFERENCE_URI,
          mimeType: 'text/markdown',
          text: REFERENCE_TEXT
        }
      ]
    })
  );
}

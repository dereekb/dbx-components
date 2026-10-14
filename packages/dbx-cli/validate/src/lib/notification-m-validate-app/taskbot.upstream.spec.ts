/**
 * Drift guard for the NotificationTaskBot checks. The validator mirrors upstream `@dereekb/firebase` /
 * `@dereekb/firebase-server` names as strings instead of importing them, so a rename upstream would silently turn the
 * `NOTIF_TASK_BOT_*` checks off. These specs read the upstream sources and fail when a mirrored name is gone.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TASK_BOT_COLLECTION, NOTIFICATION_TASK_BOT_NEXT_AT_FIELD, NOTIFICATION_TASK_BOT_UPSTREAM_NAMES } from './extract.taskbot.js';

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../../..');

const UPSTREAM_FILES = [
  'packages/firebase/src/lib/model/notification/notification.taskbot.ts',
  'packages/firebase/src/lib/model/notification/notification.taskbot.script.ts',
  'packages/firebase/src/lib/model/notification/notification.taskbot.task.ts',
  'packages/firebase-server/model/src/lib/notification/notification.taskbot.task.service.handler.ts',
  'packages/firebase-server/model/src/lib/notification/notification.taskbot.action.server.ts',
  'packages/firebase-server/model/src/lib/notification/notification.action.server.ts'
];

const INDEX_MANIFEST = 'packages/dbx-cli/generated/dereekb-firebase.model-firebase-index.mcp.generated.json';

function readUpstream(): string {
  return UPSTREAM_FILES.map((path) => readFileSync(resolve(WORKSPACE_ROOT, path), 'utf8')).join('\n');
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Matches a declaration of {@link name}: an exported type/interface/const/function/class/enum, an abstract method,
 * or an interface member.
 *
 * @param name - The mirrored name.
 * @returns The declaration pattern.
 */
function declarationPattern(name: string): RegExp {
  const n = escapeRegExp(name);
  return new RegExp(String.raw`(?:export\s+(?:declare\s+)?(?:type|interface|const|function|class|enum|abstract\s+class)\s+${n}\b)|(?:\babstract\s+${n}\s*\()|(?:^\s*(?:readonly\s+)?${n}\s*[?(:])`, 'm');
}

describe('NotificationTaskBot upstream drift guard', () => {
  const upstream = readUpstream();

  it.each(NOTIFICATION_TASK_BOT_UPSTREAM_NAMES.filter((x) => x !== NOTIFICATION_TASK_BOT_COLLECTION))('upstream still declares %s', (name) => {
    expect(declarationPattern(name).test(upstream), `\`${name}\` is mirrored by the NOTIF_TASK_BOT_* checks (extract.taskbot.ts) but no longer declared upstream. Update the mirrored name.`).toBe(true);
  });

  it('upstream still keys the NotificationTaskBot collection as ntb', () => {
    expect(upstream).toContain(`firestoreModelIdentity('notificationTaskBot', '${NOTIFICATION_TASK_BOT_COLLECTION}')`);
  });

  it('the repair query still needs only the automatic single-field nat index', () => {
    const manifest = JSON.parse(readFileSync(resolve(WORKSPACE_ROOT, INDEX_MANIFEST), 'utf8')) as { readonly entries: readonly Record<string, unknown>[] };
    const entry = manifest.entries.find((x) => x['name'] === 'notificationTaskBotsDueForRepairQuery');
    const hint = 'notificationTaskBotsDueForRepairQuery changed upstream; update NOTIF_TASK_BOT_NAT_INDEX_MISSING (rules.taskbot.ts) to check the index it now needs.';
    expect(entry, hint).toBeDefined();
    expect(entry, hint).toMatchObject({ collection: NOTIFICATION_TASK_BOT_COLLECTION, scope: 'COLLECTION', derivedComposites: [], derivedFieldOverrides: [] });
    const sequences = (entry?.['constraintSequences'] ?? []) as readonly { readonly entries: readonly unknown[] }[];
    const constraints = sequences.flatMap((x) => x.entries);
    expect(constraints, hint).toEqual([{ kind: 'where', fieldPath: NOTIFICATION_TASK_BOT_NEXT_AT_FIELD, operator: '<=' }]);
  });
});

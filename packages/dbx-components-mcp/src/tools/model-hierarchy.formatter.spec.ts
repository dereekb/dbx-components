import { describe, expect, it } from 'vitest';
import type { FirebaseModel } from '../registry/firebase-models.js';
import { buildModelHierarchy, renderModelHierarchy, type FlatHierarchyEntry, type HierarchyNode, type HierarchyResult } from './model-hierarchy.formatter.js';

function model(input: { readonly name: string; readonly identityConst: string; readonly modelType?: string; readonly prefix?: string; readonly parentIdentityConst?: string; readonly modelGroup?: string; readonly sourcePackage?: string; readonly collectionKind?: FirebaseModel['collectionKind'] }): FirebaseModel {
  return {
    name: input.name,
    identityConst: input.identityConst,
    modelType: input.modelType ?? input.name.charAt(0).toLowerCase() + input.name.slice(1),
    collectionPrefix: input.prefix ?? input.name.slice(0, 2).toLowerCase(),
    sourcePackage: input.sourcePackage ?? '@dereekb/firebase',
    sourceFile: `packages/firebase/src/lib/model/${input.name}.ts`,
    fields: [],
    enums: [],
    detectionHints: [],
    ...(input.parentIdentityConst ? { parentIdentityConst: input.parentIdentityConst } : {}),
    ...(input.modelGroup ? { modelGroup: input.modelGroup } : {}),
    ...(input.collectionKind ? { collectionKind: input.collectionKind } : {})
  };
}

const NB = model({ name: 'NotificationBox', identityConst: 'notificationBoxIdentity', prefix: 'nb', modelGroup: 'Notification', collectionKind: 'root' });
const NOTIF = model({ name: 'Notification', identityConst: 'notificationIdentity', prefix: 'nbn', parentIdentityConst: 'notificationBoxIdentity', modelGroup: 'Notification', collectionKind: 'sub-collection' });
const NOTIF_WEEK = model({ name: 'NotificationWeek', identityConst: 'notificationWeekIdentity', prefix: 'nbnw', parentIdentityConst: 'notificationBoxIdentity', modelGroup: 'Notification', collectionKind: 'sub-collection' });
const SF = model({ name: 'StorageFile', identityConst: 'storageFileIdentity', prefix: 'sf', modelGroup: 'StorageFile', collectionKind: 'root' });

const FIXTURE_MODELS: readonly FirebaseModel[] = [NB, NOTIF, NOTIF_WEEK, SF];

describe('buildModelHierarchy', () => {
  it('builds a forest of every root when no rootModel is supplied', () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, format: 'tree' });
    expect(result.tree).toBeDefined();
    expect(result.flat).toBeUndefined();
    const tree = result.tree as readonly HierarchyNode[];
    expect(tree.map((n) => n.name)).toEqual(['NotificationBox', 'StorageFile']);
    const nb = tree[0];
    expect(nb.children.map((c) => c.name)).toEqual(['Notification', 'NotificationWeek']);
    expect(nb.children[0].depth).toBe(1);
    expect(nb.children[0].parent).toBe('notificationBoxIdentity');
    expect(result.summary.rootCount).toBe(2);
    expect(result.summary.totalModels).toBe(4);
    expect(result.summary.maxDepthReached).toBe(1);
    expect(result.summary.truncatedAtDepth).toBeUndefined();
  });

  it('returns just the requested subtree when rootModel is supplied', () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, rootModel: NB, format: 'tree' });
    expect(result.summary.rootCount).toBe(1);
    expect(result.summary.totalModels).toBe(3);
    const tree = result.tree as readonly HierarchyNode[];
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('NotificationBox');
    expect(tree[0].children.map((c) => c.name)).toEqual(['Notification', 'NotificationWeek']);
  });

  it('clamps depth and reports truncatedAtDepth', () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, rootModel: NB, maxDepth: 0, format: 'tree' });
    const tree = result.tree as readonly HierarchyNode[];
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([]);
    expect(result.summary.truncatedAtDepth).toBe(0);
    expect(result.summary.maxDepthReached).toBe(0);
  });

  it('does not flag truncation when maxDepth is set but the tree fits inside it', () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, rootModel: NB, maxDepth: 5, format: 'tree' });
    expect(result.summary.truncatedAtDepth).toBeUndefined();
  });

  it("emits flat entries depth-first with parent back-refs when format='flat'", () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, format: 'flat' });
    expect(result.tree).toBeUndefined();
    const flat = result.flat as readonly FlatHierarchyEntry[];
    expect(flat.map((e) => `${e.depth}:${e.name}`)).toEqual(['0:NotificationBox', '1:Notification', '1:NotificationWeek', '0:StorageFile']);
    expect(flat[1].parent).toBe('notificationBoxIdentity');
    expect(flat[0].parent).toBeUndefined();
  });

  it("emits both tree and flat when format='both'", () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, format: 'both' });
    expect(result.tree).toBeDefined();
    expect(result.flat).toBeDefined();
    expect((result.flat as readonly FlatHierarchyEntry[]).length).toBe(4);
  });

  it('preserves modelGroup on every node', () => {
    const result = buildModelHierarchy({ models: FIXTURE_MODELS, format: 'both' });
    const tree = result.tree as readonly HierarchyNode[];
    expect(tree[0].modelGroup).toBe('Notification');
    expect(tree[0].children[0].modelGroup).toBe('Notification');
    const flat = result.flat as readonly FlatHierarchyEntry[];
    expect(flat[0].modelGroup).toBe('Notification');
  });
});

describe('renderModelHierarchy', () => {
  const RESULT: HierarchyResult = buildModelHierarchy({ models: FIXTURE_MODELS, format: 'both' });

  it('returns valid JSON with output=json', () => {
    const text = renderModelHierarchy(RESULT, 'json');
    const parsed = JSON.parse(text);
    expect(parsed.summary.rootCount).toBe(2);
    expect(parsed.tree).toHaveLength(2);
    expect(parsed.flat).toHaveLength(4);
  });

  it('renders markdown with tree and flat sections', () => {
    const text = renderModelHierarchy(RESULT, 'markdown');
    expect(text).toContain('# Firebase model hierarchy');
    expect(text).toContain('## Tree');
    expect(text).toContain('## Flat (4)');
    expect(text).toContain('**NotificationBox**');
    expect(text).toContain('**Notification**');
    expect(text).toContain('**StorageFile**');
    expect(text).toContain('_[Notification]_');
  });

  it('echoes header context (rootModel, scope, maxDepth) when supplied', () => {
    const truncated = buildModelHierarchy({ models: FIXTURE_MODELS, rootModel: NB, maxDepth: 0, format: 'tree' });
    const text = renderModelHierarchy(truncated, 'markdown', { scope: 'upstream', rootModel: 'notificationBoxIdentity', maxDepth: 0 });
    expect(text).toContain('scope: upstream');
    expect(text).toContain('from `notificationBoxIdentity`');
    expect(text).toContain('maxDepth=0');
    expect(text).toContain('_Truncated at depth 0');
  });

  it('omits scope/rootModel/maxDepth bits when none supplied or scope=all', () => {
    const text = renderModelHierarchy(RESULT, 'markdown', { scope: 'all' });
    expect(text).not.toContain('scope:');
    expect(text).not.toContain('from `');
    expect(text).not.toContain('maxDepth=');
  });
});

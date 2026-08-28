/**
 * Stage 2b — annotate each collected entry with the invocation mode `firestore.rules` implies.
 *
 * The two halves of this already existed and simply never met: `scanFirestoreRules()` has reported
 * `collectionGroup` / `list` per collection since it was written, and the catalog has always
 * recorded each entry's `scope` + `isNested`. Joining them at GENERATION time is what turns
 * "~1/3 of the catalog is a guaranteed `permission-denied`" from something every consumer
 * rediscovers one wasted call at a time into a field on the entry.
 *
 * The rule itself lives in the shipped package (`cliFirestoreQueryModeForRules`) so the CLI's
 * runtime refusal and this annotation can never drift apart. This module owns only the join: read
 * the rules file, look each entry's collection up, derive the `--parent` path templates.
 */

import { firestoreRulesAccessForCollection, scanFirestoreRules, type FirestoreRulesScan } from '../../firestore-rules/src/index.js';
import { cliFirestoreQueryModeForRules } from '../../src/lib/firestore/query-mode.js';
import type { CollectedQueryEntry } from './types.js';

/**
 * Input for {@link annotateQueryEntryMode}.
 */
export interface AnnotateQueryEntryModeInput {
  readonly entries: readonly CollectedQueryEntry[];
  /**
   * The full text of the app's `firestore.rules`.
   */
  readonly rulesSource: string;
}

/**
 * Tally of what the annotation found, for the generator's summary line.
 */
export interface AnnotateQueryEntryModeResult {
  readonly entries: readonly CollectedQueryEntry[];
  readonly model: number;
  /**
   * Slugs no client can run at any scope — the genuine defects, named rather than only counted so
   * the generator can warn per entry.
   */
  readonly unavailableSlugs: readonly string[];
  /**
   * Slugs that run only when scoped with `--parent`. Not a defect; a usage constraint.
   */
  readonly parentChildSlugs: readonly string[];
}

/**
 * Stamps `queryMode` + `rules` onto every entry, from a scan of the supplied rules source.
 *
 * Every entry is annotated, including the plain `model` ones: absence of the field has to keep meaning
 * "the generator was run without `--rules`", so that a manifest generated without the rules file
 * never reads as a fleet of directly-runnable queries.
 *
 * @param input - The collected entries and the rules source.
 * @returns The annotated entries plus a per-mode tally.
 */
export function annotateQueryEntryMode(input: AnnotateQueryEntryModeInput): AnnotateQueryEntryModeResult {
  const { entries, rulesSource } = input;
  const scan = scanFirestoreRules(rulesSource);

  let model = 0;
  const unavailableSlugs: string[] = [];
  const parentChildSlugs: string[] = [];

  const annotated = entries.map((entry) => {
    const rules = firestoreRulesAccessForCollection(scan, entry.collection);
    const { mode, rules: entryRules } = cliFirestoreQueryModeForRules({
      scope: entry.scope,
      isNested: entry.isNested,
      collectionGroup: rules.collectionGroup,
      list: rules.list,
      parentPaths: parentPathsForCollection(scan, entry.collection)
    });

    if (mode === 'model') {
      model += 1;
    } else if (mode === 'parent-child') {
      parentChildSlugs.push(entry.slug);
    } else {
      unavailableSlugs.push(entry.slug);
    }

    return { ...entry, queryMode: mode, rules: entryRules };
  });

  return { entries: annotated, model, unavailableSlugs, parentChildSlugs };
}

/**
 * Derives the `--parent` document-path templates for a collection from its rules match paths.
 *
 * A path is usable only when it is NESTED (more than the collection + its id) and carries no
 * recursive wildcard — `/{path=**}/jlja/{id}` names no concrete parent, and `/gb/{guestbook}` has
 * no parent at all. `/jl/{jobLocation}/jlj/{job}/jlja/{id}` yields `jl/{jobLocation}/jlj/{job}`.
 *
 * @param scan - The rules scan.
 * @param collection - The short collection name.
 * @returns The distinct parent-path templates, in scan order.
 */
function parentPathsForCollection(scan: FirestoreRulesScan, collection: string): readonly string[] {
  const paths = firestoreRulesAccessForCollection(scan, collection).paths;
  const parents = new Set<string>();

  for (const path of paths) {
    const segments = path.split('/').filter((x) => x.length > 0);
    // drop the trailing `<collection>/{id}` pair; what remains is the parent document path
    const parentSegments = segments.slice(0, -2);

    if (parentSegments.length > 0 && !parentSegments.some((x) => x.includes('=**'))) {
      parents.add(parentSegments.join('/'));
    }
  }

  return Array.from(parents);
}

/**
 * Constraint-helper expansion registry used by the model-firebase-index
 * extractor.
 *
 * The query factories under scan compose `@dereekb/firebase` helpers
 * (`whereDateIsBeforeWithSort`, `whereDateIsBetween`,
 * `allChildDocumentsUnderRelativePath`, …) that internally fan out to one
 * or more base `where` / `orderBy` constraints. Static AST walking only
 * sees the helper call — to derive the actual Firestore index requirements
 * the extractor needs to know which base constraints the helper produces.
 * This file is the source of truth for that mapping.
 *
 * Each entry declares:
 *   - which positional argument carries the field path
 *   - which positional argument carries the `OrderByDirection` (if any)
 *   - the ordered base constraints the helper emits, with operators or
 *     orderBy directions resolved from the call site when possible
 *
 * The extractor reads the call site, plugs the resolved field path and
 * direction into the descriptor, and emits {@link ConstraintSequenceEntry}
 * rows tagged with `fromHelper: <helperName>` so diagnostics remain
 * faithful to the source factory.
 */

import type { ConstraintSequenceEntry, FirestoreWhereOperator } from '../manifest/model-firebase-index-schema.js';

/**
 * Description of one base constraint a helper expands into. `direction`
 * resolves at call-site time from the helper's direction argument when
 * `useCallSiteDirection` is set; otherwise it falls back to the literal
 * `direction` here. `operator` is required when `kind === 'where'`.
 */
export interface FirestoreQueryHelperExpansionPart {
  readonly kind: 'where' | 'orderBy';
  readonly operator?: FirestoreWhereOperator;
  readonly direction?: 'asc' | 'desc';
  /**
   * When `true` and the helper resolves a direction from its call-site
   * argument, override the literal `direction` above.
   */
  readonly useCallSiteDirection?: boolean;
}

/**
 * One entry in the helper expansion registry.
 */
export interface FirestoreQueryHelperDescriptor {
  /**
   * Helper function name as it appears in source (e.g. `whereDateIsBetween`).
   */
  readonly name: string;
  /**
   * Index of the call argument carrying the field path. The extractor reads
   * the string literal at this position (or the identifier when the call
   * passes a `FieldPath` constant — currently treated as opaque, dropping
   * the entry with a warning).
   */
  readonly fieldArgIndex: number;
  /**
   * Index of the call argument carrying the `OrderByDirection`. Undefined
   * when the helper does not accept one (e.g. `whereDateIsBefore`).
   */
  readonly directionArgIndex?: number;
  /**
   * Default direction when the call-site direction argument is absent.
   */
  readonly defaultDirection?: 'asc' | 'desc';
  /**
   * Ordered list of the base constraints the helper expands into. Field
   * path is the same for every part (helpers always operate on one field).
   */
  readonly parts: readonly FirestoreQueryHelperExpansionPart[];
}

/**
 * Built-in helper expansions. Mirrors the upstream
 * `@dereekb/firebase/constraint.template.ts` implementations as of writing.
 * Helpers not listed here are extracted as a single opaque `where` call so
 * the entry still surfaces during validation — the extractor emits a
 * warning so a missing helper can be added here.
 *
 * Order within `parts` is significant: it mirrors the source helper's
 * emitted constraint array order, which the analyzer treats as the user's
 * intended Firestore index field order.
 */
export const FIRESTORE_QUERY_HELPERS: readonly FirestoreQueryHelperDescriptor[] = [
  // Inequality helpers — single base where, no orderBy.
  { name: 'whereDateIsBefore', fieldArgIndex: 0, parts: [{ kind: 'where', operator: '<' }] },
  { name: 'whereDateIsAfter', fieldArgIndex: 0, parts: [{ kind: 'where', operator: '>' }] },
  { name: 'whereDateIsOnOrBefore', fieldArgIndex: 0, parts: [{ kind: 'where', operator: '<=' }] },
  { name: 'whereDateIsOnOrAfter', fieldArgIndex: 0, parts: [{ kind: 'where', operator: '>=' }] },

  // *WithSort variants — base where + orderBy on the same field. Helper
  // emits orderBy first, then where. Matches `constraint.template.ts`.
  {
    name: 'whereDateIsBeforeWithSort',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' },
      { kind: 'where', operator: '<' }
    ]
  },
  {
    name: 'whereDateIsAfterWithSort',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' },
      { kind: 'where', operator: '>' }
    ]
  },
  {
    name: 'whereDateIsOnOrBeforeWithSort',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' },
      { kind: 'where', operator: '<=' }
    ]
  },
  {
    name: 'whereDateIsOnOrAfterWithSort',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' },
      { kind: 'where', operator: '>=' }
    ]
  },

  // Range helpers — two-bound where + orderBy.
  {
    name: 'whereDateIsBetween',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'where', operator: '>=' },
      { kind: 'where', operator: '<=' },
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' }
    ]
  },
  {
    name: 'whereDateIsInRange',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'where', operator: '>=' },
      { kind: 'where', operator: '<=' },
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' }
    ]
  },

  // Dynamic single-field helper. The body branches on which DateRange bounds
  // are present, but every branch operates on the same fieldPath argument and
  // produces some subset of orderBy(field) + where(field,'>=') + where(field,'<=').
  // For Firestore composite-index purposes the worst-case set collapses to a
  // single ordered range index on that field — so the descriptor emits the
  // worst case unconditionally. The body's internal conditionals are NOT
  // scanned (helpers are opaque to the extractor; only tagged callers are).
  {
    name: 'filterWithDateRange',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'where', operator: '>=' },
      { kind: 'where', operator: '<=' },
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' }
    ]
  },

  // Prefix-string and child-doc helpers — range where + orderBy.
  {
    name: 'whereStringValueHasPrefix',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'where', operator: '>=' },
      { kind: 'where', operator: '<' },
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' }
    ]
  },
  {
    name: 'allChildDocumentsUnderRelativePath',
    fieldArgIndex: 0,
    directionArgIndex: 2,
    defaultDirection: 'asc',
    parts: [
      { kind: 'where', operator: '>=' },
      { kind: 'where', operator: '<' },
      { kind: 'orderBy', useCallSiteDirection: true, direction: 'asc' }
    ]
  }
];

/**
 * Lookup helper by name. Returns `undefined` when the helper isn't in the
 * registry — the extractor treats that as an opaque call (no constraints
 * emitted) and surfaces a warning so the registry can be extended.
 *
 * @param name - the helper's source-level identifier
 * @returns the descriptor or undefined
 */
export function getFirestoreQueryHelperDescriptor(name: string): FirestoreQueryHelperDescriptor | undefined {
  return FIRESTORE_QUERY_HELPERS.find((h) => h.name === name);
}

/**
 * Resolves the constraint entries a helper call produces given the
 * resolved field path and (optional) call-site direction. The extractor
 * supplies the parsed values; this function applies the descriptor's
 * `parts` template.
 *
 * @param input - the resolved descriptor + call-site values
 * @returns the ordered constraint entries the helper emits
 */
export function expandFirestoreQueryHelper(input: { readonly descriptor: FirestoreQueryHelperDescriptor; readonly fieldPath: string; readonly direction?: 'asc' | 'desc' }): readonly ConstraintSequenceEntry[] {
  const { descriptor, fieldPath, direction } = input;
  const resolvedDirection = direction ?? descriptor.defaultDirection;
  const out: ConstraintSequenceEntry[] = [];
  for (const part of descriptor.parts) {
    if (part.kind === 'where') {
      const operator: FirestoreWhereOperator = part.operator ?? '==';
      out.push({ kind: 'where', fieldPath, operator, fromHelper: descriptor.name });
    } else {
      const direction = part.useCallSiteDirection && resolvedDirection !== undefined ? resolvedDirection : (part.direction ?? 'asc');
      out.push({ kind: 'orderBy', fieldPath, direction, fromHelper: descriptor.name });
    }
  }
  return out;
}

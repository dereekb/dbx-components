/**
 * Adds `// @__NO_SIDE_EFFECTS__` magic-comment annotations above factory function
 * declarations across @dereekb/* packages so esbuild and other tree-shakers can drop
 * unused factory call results.
 *
 * Detection (a function qualifies if any of these hold):
 *   - Its preceding JSDoc contains `@dbxUtilKind factory`.
 *   - Its name ends in `Factory`, `Service`, or `Function`.
 *   - Its name starts with `make`, `build`, or `create` followed by an uppercase letter.
 *
 * For overloaded `export function` declarations, only the implementation signature
 * (the one whose line ends in `{`, possibly after a multi-line signature) is annotated;
 * pure type-only overloads (lines ending in `;`) are skipped.
 *
 * The script is idempotent: existing `// @__NO_SIDE_EFFECTS__` is detected and skipped.
 *
 * With `--with-jsdoc-tags`, the script also adds `@dbxUtil` and `@dbxUtilKind factory`
 * to the JSDoc block when missing (creating a minimal block if no JSDoc is present).
 *
 * Usage:
 *   node tools/scripts/add-no-side-effects-annotations.mjs [--dry-run] [--with-jsdoc-tags] [glob-pattern...]
 *
 * Default scope: packages/<all>/src/lib/<all>.ts (excluding *.spec.ts, *.test.ts).
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { glob } from 'glob';

const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WITH_JSDOC_TAGS = args.includes('--with-jsdoc-tags');
const PATTERNS = args.filter((a) => !a.startsWith('--'));

const DEFAULT_PATTERNS = ['packages/*/src/**/*.ts'];

const FACTORY_SUFFIX_RE = /(?:Factory|Factories|Service|Services|Function|Functions)$/;
const FACTORY_PREFIX_RE = /^(?:make|build|create)[A-Z]/;
const DOMAIN_PREFIX_RE = /^(?:firestore|optionalFirestore)[A-Z]/;
const EXPLICIT_FACTORY_NAMES = new Set([
  // From the original notes; many already match the patterns above, listed for explicitness.
  'cachedGetter',
  'primativeKeyDencoder',
  'primativeKeyStringDencoder',
  'firestoreModelIdentity',
  'snapshotConverterFunctions',
  'dateTimezoneUtcNormal',
  'modelStorageSlashPathFactory',
  'authRoleClaimsService',
  'mappedUseAsyncFunction',
  'cutValueToPrecisionFunction',
  'transformStringFunction',
  'indexedValuesArrayAccessorFactory',
  'objectDeltaArrayCompressor',
  'objectFieldEqualityChecker',
  'assignValuesToPOJOFunction',
  'yearWeekCodeFactory',
  'callModelFirebaseFunctionMapFactory',
  'grantModelRolesIfHasAuthRolesFactory',
  'copyUserRelatedDataAccessorFactoryFunction'
]);
const ANNOTATION = '// @__NO_SIDE_EFFECTS__';
const JSDOC_TAG_LINE = '@dbxUtilKind factory';
const JSDOC_PRESENCE_TAG = '@dbxUtil';

function isExcludedFile(file) {
  return file.endsWith('.spec.ts') || file.endsWith('.test.ts') || file.endsWith('.d.ts');
}

function deriveCategory(filePath) {
  const segs = filePath.split('/');
  // pick a meaningful segment after src/lib if present
  const libIdx = segs.lastIndexOf('lib');
  if (libIdx >= 0 && libIdx + 1 < segs.length) {
    const next = segs[libIdx + 1];
    if (next.endsWith('.ts')) {
      return next.replace(/\.ts$/, '').split('.')[0];
    }
    return next;
  }
  return 'util';
}

function findJsdocBounds(lines, signatureLine) {
  // Walk upward from signatureLine - 1, skipping blank lines.
  let cursor = signatureLine - 1;
  while (cursor >= 0 && lines[cursor].trim() === '') cursor--;
  if (cursor < 0) return null;

  // Check for existing // @__NO_SIDE_EFFECTS__ above the signature; if present,
  // walk past it to look for JSDoc above that.
  let annotationLine = -1;
  if (lines[cursor].trim() === ANNOTATION) {
    annotationLine = cursor;
    cursor--;
    while (cursor >= 0 && lines[cursor].trim() === '') cursor--;
    if (cursor < 0) return { jsdocStart: -1, jsdocEnd: -1, annotationLine };
  }

  if (!lines[cursor].trim().endsWith('*/')) {
    return { jsdocStart: -1, jsdocEnd: -1, annotationLine };
  }

  const jsdocEnd = cursor;
  // walk up to find /**
  while (cursor >= 0 && !lines[cursor].trim().startsWith('/**')) cursor--;
  if (cursor < 0) return { jsdocStart: -1, jsdocEnd: -1, annotationLine };

  return { jsdocStart: cursor, jsdocEnd, annotationLine };
}

function isImplementationSignature(lines, startIdx) {
  // The first line. If it ends with `{`, implementation. If `;`, overload. Otherwise scan forward.
  for (let j = startIdx; j < Math.min(startIdx + 20, lines.length); j++) {
    const trimmed = lines[j].replace(/\/\/.*$/, '').trimEnd();
    if (trimmed.endsWith('{')) return true;
    if (trimmed.endsWith(';')) return false;
  }
  return false;
}

function processFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const edits = [];
  const stats = { annotated: 0, jsdocFilled: 0, skippedAlreadyAnnotated: 0, overloads: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\s*)export function ([a-zA-Z_$][\w$]*)\b/);
    if (!m) continue;

    const indent = m[1];
    const name = m[2];

    const jsdoc = findJsdocBounds(lines, i);
    const jsdocText = jsdoc && jsdoc.jsdocStart >= 0 ? lines.slice(jsdoc.jsdocStart, jsdoc.jsdocEnd + 1).join('\n') : '';
    const hasFactoryTag = jsdocText.includes(JSDOC_TAG_LINE);

    const matchesNamePattern = FACTORY_SUFFIX_RE.test(name) || FACTORY_PREFIX_RE.test(name) || DOMAIN_PREFIX_RE.test(name) || EXPLICIT_FACTORY_NAMES.has(name);
    const isFactory = hasFactoryTag || matchesNamePattern;

    if (!isFactory) continue;

    if (!isImplementationSignature(lines, i)) {
      stats.overloads++;
      continue;
    }

    const annotationAlreadyPresent = jsdoc && jsdoc.annotationLine >= 0;
    const insertAnnotationAt = jsdoc && jsdoc.jsdocEnd >= 0 ? jsdoc.jsdocEnd + 1 : i;

    if (annotationAlreadyPresent) {
      stats.skippedAlreadyAnnotated++;
    } else {
      edits.push({ line: insertAnnotationAt, text: indent + ANNOTATION });
      stats.annotated++;
    }

    if (WITH_JSDOC_TAGS && !hasFactoryTag) {
      const category = deriveCategory(filePath);
      if (jsdoc && jsdoc.jsdocStart >= 0) {
        // Insert tags before */.
        const closeLine = lines[jsdoc.jsdocEnd];
        const starPrefix = closeLine.replace(/\*\/.*$/, '*');
        const tagLines = [];
        if (!jsdocText.includes(JSDOC_PRESENCE_TAG)) tagLines.push(`${starPrefix} ${JSDOC_PRESENCE_TAG}`);
        if (!jsdocText.includes('@dbxUtilCategory')) tagLines.push(`${starPrefix} @dbxUtilCategory ${category}`);
        tagLines.push(`${starPrefix} ${JSDOC_TAG_LINE}`);
        edits.push({ line: jsdoc.jsdocEnd, text: tagLines.join('\n') });
      } else {
        const newJsdoc = [`${indent}/**`, `${indent} * ${JSDOC_PRESENCE_TAG}`, `${indent} * @dbxUtilCategory ${category}`, `${indent} * ${JSDOC_TAG_LINE}`, `${indent} */`].join('\n');
        edits.push({ line: i, text: newJsdoc });
      }
      stats.jsdocFilled++;
    }
  }

  if (edits.length === 0) return stats;

  edits.sort((a, b) => b.line - a.line);
  for (const edit of edits) {
    const insertLines = edit.text.split('\n');
    lines.splice(edit.line, 0, ...insertLines);
  }

  if (!DRY_RUN) {
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  return stats;
}

function main() {
  const patterns = (PATTERNS.length > 0 ? PATTERNS : DEFAULT_PATTERNS).map((p) => (p.startsWith('/') ? p : resolve(ROOT_DIR, p)));

  const files = new Set();
  for (const pattern of patterns) {
    for (const f of glob.sync(pattern, { absolute: true })) {
      try {
        if (statSync(f).isFile() && !isExcludedFile(f)) files.add(f);
      } catch {
        /* ignore */
      }
    }
  }

  const totals = { files: 0, filesChanged: 0, annotated: 0, jsdocFilled: 0, skippedAlreadyAnnotated: 0, overloads: 0 };
  for (const f of files) {
    totals.files++;
    const s = processFile(f);
    if (s.annotated > 0 || s.jsdocFilled > 0) totals.filesChanged++;
    totals.annotated += s.annotated;
    totals.jsdocFilled += s.jsdocFilled;
    totals.skippedAlreadyAnnotated += s.skippedAlreadyAnnotated;
    totals.overloads += s.overloads;
  }

  const tag = DRY_RUN ? '(DRY-RUN) ' : '';
  console.log(`${tag}Scanned ${totals.files} files; changed ${totals.filesChanged}. ` + `Annotated ${totals.annotated} factories. ` + `JSDoc tags filled: ${totals.jsdocFilled}. ` + `Skipped (already annotated): ${totals.skippedAlreadyAnnotated}. ` + `Overload signatures skipped: ${totals.overloads}.`);
}

main();

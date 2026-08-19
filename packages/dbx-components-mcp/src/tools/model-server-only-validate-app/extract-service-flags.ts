/**
 * Reads the RUNTIME leg of the server-only reconciliation out of a component's
 * `src/lib/model/service.ts`.
 *
 * For every `@dbxModelServiceFactory <modelType>`-tagged export it captures three things the other
 * two legs need to join against:
 *
 *   - the model type (from the tag) — the key everything joins on;
 *   - the model's TS data type name (the SECOND type argument of `firebaseModelServiceFactory<…>`) —
 *     which names the interface the `@dbxModelServerOnly` tag would sit on;
 *   - whether the config object literal carries `serverOnly: true`.
 *
 * Deliberately a source scan rather than a ts-morph project: the shape is a fixed, generated-looking
 * declaration list, and the alternative — an in-memory ts-morph project — cannot follow imports into
 * the upstream packages that declare most of these models anyway, so it would buy nothing here.
 */

// MARK: Types
/**
 * One registered model service, as declared in a component's `service.ts`.
 */
export interface ExtractedModelServiceFlag {
  readonly modelType: string;
  /**
   * The exported binding (e.g. `guestbookFirebaseModelServiceFactory`).
   */
  readonly exportName: string;
  /**
   * The model's TS data type name — the second type argument. `undefined` when the call has no
   * explicit type arguments.
   */
  readonly modelName: string | undefined;
  /**
   * True when the config object literal carries `serverOnly: true`.
   */
  readonly serverOnly: boolean;
  /**
   * 1-based line of the `export const` declaration.
   */
  readonly line: number;
}

const SERVICE_FACTORY_TAG = /@dbxModelServiceFactory\s+([A-Za-z_$][\w$]*)/;
const FACTORY_DECLARATION = /^export const ([A-Za-z_$][\w$]*)\s*=\s*firebaseModelServiceFactory\s*(<)?/;

/**
 * Extracts every `@dbxModelServiceFactory`-tagged `firebaseModelServiceFactory(...)` declaration
 * from a component's `service.ts` source.
 *
 * @param source - The full text of the service file.
 * @returns One record per tagged declaration, in source order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function extractModelServiceFlags(source: string): readonly ExtractedModelServiceFlag[] {
  const lines = source.split('\n');
  const out: ExtractedModelServiceFlag[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const declaration = FACTORY_DECLARATION.exec(lines[index] ?? '');

    if (declaration == null) continue;

    const modelType = findServiceFactoryTag(lines, index);

    if (modelType == null) continue;

    const region = source.slice(offsetOfLine(lines, index));
    out.push({
      modelType,
      exportName: declaration[1] as string,
      modelName: readSecondTypeArgument(region),
      serverOnly: configHasServerOnly(region),
      line: index + 1
    });
  }

  return out;
}

/**
 * Reads the `@dbxModelServiceFactory <modelType>` tag off the JSDoc block ATTACHED to a declaration.
 *
 * "Attached" is load-bearing. Walking backwards until the first `/**` would sail past the `*\/` of an
 * unrelated preceding block and credit ITS tag to an untagged declaration, so the walk first requires
 * the nearest non-blank line above the declaration to be a block close.
 *
 * @param lines - The source split by line.
 * @param declarationIndex - 0-based index of the `export const` line.
 * @returns The tag's model type, or `undefined` when the declaration carries no JSDoc, or its JSDoc
 *   carries no tag.
 */
function findServiceFactoryTag(lines: readonly string[], declarationIndex: number): string | undefined {
  let cursor = declarationIndex - 1;

  while (cursor >= 0 && (lines[cursor] ?? '').trim().length === 0) {
    cursor -= 1;
  }

  let result: string | undefined;

  if (cursor >= 0 && (lines[cursor] as string).trim().endsWith('*/')) {
    for (let index = cursor; index >= 0; index -= 1) {
      const line = lines[index] as string;
      const tag = SERVICE_FACTORY_TAG.exec(line);

      if (tag) {
        result = tag[1];
        break;
      }

      if (line.includes('/**')) break;
    }
  }

  return result;
}

function offsetOfLine(lines: readonly string[], index: number): number {
  let offset = 0;

  for (let i = 0; i < index; i += 1) {
    offset += (lines[i] as string).length + 1;
  }

  return offset;
}

/**
 * Reads the second type argument of `firebaseModelServiceFactory<Ctx, Model, Doc, Roles>(…)`.
 *
 * Splits at the TOP nesting level only, so a type argument that is itself generic (e.g.
 * `PagedItemPageData<NotificationItem>`) survives intact.
 *
 * @param region - Source text starting at the declaration.
 * @returns The second type argument, trimmed, or `undefined` when there are none.
 */
function readSecondTypeArgument(region: string): string | undefined {
  const open = region.indexOf('<');
  const callOpen = region.indexOf('(');
  let result: string | undefined;

  if (open >= 0 && (callOpen < 0 || open < callOpen)) {
    const args: string[] = [];
    let depth = 0;
    let current = '';

    for (let index = open + 1; index < region.length; index += 1) {
      const char = region[index];

      if (char === '<') {
        depth += 1;
        current += char;
      } else if (char === '>') {
        if (depth === 0) {
          args.push(current);
          break;
        }
        depth -= 1;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    const second = args[1]?.trim();
    result = second != null && second.length > 0 ? second : undefined;
  }

  return result;
}

/**
 * Reports whether the config object literal passed to the factory carries `serverOnly: true`.
 *
 * Scans only the balanced-brace region of the FIRST argument object so a `serverOnly` on a later,
 * unrelated declaration in the same file is never miscredited.
 *
 * @param region - Source text starting at the declaration.
 * @returns `true` when the config sets `serverOnly: true`.
 */
function configHasServerOnly(region: string): boolean {
  const brace = region.indexOf('{');
  let result = false;

  if (brace >= 0) {
    let depth = 0;
    let end = region.length;

    for (let index = brace; index < region.length; index += 1) {
      const char = region[index];

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;

        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    result = /(^|[\s{,])serverOnly\s*:\s*true\b/.test(region.slice(brace, end));
  }

  return result;
}

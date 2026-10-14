/**
 * Matches a JSDoc/TSDoc inline link tag: `{@link …}`, `{@linkplain …}` or `{@linkcode …}`.
 *
 * Group 1 is the tag variant (`link`, `linkplain` or `linkcode`), group 2 is the tag body (target plus optional label).
 */
const JSDOC_INLINE_LINK_REGEX = /\{@(link|linkplain|linkcode)\s+([^}]*)\}/g;

/**
 * Matches a URL link target, such as `https://example.com`.
 */
const JSDOC_LINK_URL_TARGET_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Returns the display text of a JSDoc link target with no label.
 *
 * `Foo#bar` becomes `Foo.bar`, and a path target such as `./path/mod#member` keeps only `member`.
 *
 * @param target - The link target.
 * @returns The display text for the target.
 */
function jsDocLinkTargetDisplayText(target: string): string {
  let result = target;

  if (!JSDOC_LINK_URL_TARGET_REGEX.test(target)) {
    const hashIndex = target.indexOf('#');

    if (hashIndex !== -1) {
      const owner = target.slice(0, hashIndex);
      const member = target.slice(hashIndex + 1);
      result = owner.includes('/') || !owner ? member : `${owner}.${member}`;
    }
  }

  return result;
}

/**
 * Replaces JSDoc/TSDoc inline link tags (`{@link X}`, `{@linkplain X}`, `{@linkcode X}`) with plain display text.
 *
 * - `{@link Foo}` → `Foo`
 * - `{@link Foo.bar}` → `Foo.bar`
 * - `{@link Foo | the foo}` and `{@link Foo the foo}` → `the foo`
 * - `{@link Foo#bar}` → `Foo.bar`
 * - `{@link ./path/mod#member}` → `member`
 * - `{@linkcode Foo}` → `` `Foo` ``
 * - `{@link https://example.com}` → `https://example.com`, and with a label, the label.
 *
 * Text without tags, and malformed tags with no target, are returned unchanged.
 *
 * @param input - The text to convert, typically a JSDoc description.
 * @returns The text with every inline link tag replaced by its display text.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags jsdoc, tsdoc, link, markdown, text, documentation
 * @dbxUtilRelated first-sentence
 *
 * @example
 * ```ts
 * jsDocInlineLinksToText('Creates a {@link NotificationBox} for the {@link Profile.uid}.');
 * // 'Creates a NotificationBox for the Profile.uid.'
 * ```
 */
export function jsDocInlineLinksToText(input: string): string {
  return input.replaceAll(JSDOC_INLINE_LINK_REGEX, (match: string, variant: string, body: string) => {
    const trimmedBody = body.trim();
    let result = match;

    if (trimmedBody) {
      const pipeIndex = trimmedBody.indexOf('|');
      let target: string;
      let label: string | undefined;

      if (pipeIndex === -1) {
        const spaceIndex = trimmedBody.search(/\s/);
        target = spaceIndex === -1 ? trimmedBody : trimmedBody.slice(0, spaceIndex);
        label = spaceIndex === -1 ? undefined : trimmedBody.slice(spaceIndex + 1).trim();
      } else {
        target = trimmedBody.slice(0, pipeIndex).trim();
        label = trimmedBody.slice(pipeIndex + 1).trim();
      }

      const text = label || jsDocLinkTargetDisplayText(target);

      if (text) {
        result = variant === 'linkcode' ? `\`${text}\`` : text;
      }
    }

    return result;
  });
}

/**
 * Angular input transform that converts an empty string to `undefined`.
 *
 * Useful for Angular directive inputs where the attribute can be applied without a value
 * (e.g., `<div myDirective>` passes `''`), and you want to treat that as "not provided".
 *
 * @param value - The input value to transform.
 * @returns The original value, or `undefined` if the value is an empty string.
 *
 * @example
 * ```typescript
 * @Directive({ selector: '[appHighlight]' })
 * export class HighlightDirective {
 *   @Input({ alias: 'appHighlight', transform: transformEmptyStringInputToUndefined })
 *   color?: string;
 * }
 * ```
 */
export const transformEmptyStringInputToUndefined = <T>(value: T | '') => (value === '' ? undefined : value);

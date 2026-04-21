import type { ArrayItemDefinitionTemplate } from '@ng-forge/dynamic-forms';

/**
 * Produces a clone of an array-item template with `value` pre-populated on each
 * leaf field based on the source item's values.
 *
 * ng-forge's `insertAt(index, template)` event creates a new array slot initialized
 * from the provided field-definition template — it does not accept a raw value. To
 * duplicate an existing item, we walk the template tree and stamp the source
 * values onto each field definition's `value` property.
 *
 * Behavior:
 * - Leaf fields receive `value` from `source[field.key]`.
 * - Container/group fields recurse into `source[field.key]` when that sub-value
 *   is an object; otherwise the nested source is passed through unchanged.
 * - Fields missing from `source` keep their original `value` (or default).
 * - Non-object / null source values short-circuit and return the template unchanged.
 *
 * Returns a new template; the input is not mutated.
 *
 * @param template - The array-item field-definition template to clone.
 * @param sourceItem - The existing item whose values should be stamped onto the clone. Non-object values (null/undefined/primitive) cause the template to be returned unchanged.
 * @returns A new `ArrayItemDefinitionTemplate` with `value` populated on each leaf field, or the input `template` reference when `sourceItem` is not an object.
 *
 * @example
 * // Duplicate an existing item by cloning its template with its values stamped in
 * const template = [
 *   { key: 'name', type: 'input', value: '' },
 *   { key: 'disabled', type: 'checkbox', value: false }
 * ];
 * const duplicated = dbxForgeArrayFieldTemplateWithItemValues(template, { name: 'hello', disabled: true });
 * // duplicated[0].value === 'hello', duplicated[1].value === true
 */
export function dbxForgeArrayFieldTemplateWithItemValues(template: ArrayItemDefinitionTemplate, sourceItem: unknown): ArrayItemDefinitionTemplate {
  let result: ArrayItemDefinitionTemplate = template;

  if (sourceItem != null && typeof sourceItem === 'object') {
    const source = sourceItem as Record<string, unknown>;

    // Template may be a single FieldDef (primitive item) or FieldDef[] (object/container item)
    if (Array.isArray(template)) {
      result = template.map((field) => _withValuesFromSource(field, source)) as ArrayItemDefinitionTemplate;
    } else {
      result = _withValuesFromSource(template as unknown, source) as ArrayItemDefinitionTemplate;
    }
  }

  return result;
}

function _withValuesFromSource(field: unknown, source: Record<string, unknown>): unknown {
  let result: unknown = field;

  if (field != null && typeof field === 'object') {
    const node = field as { key?: string; type?: string; fields?: unknown[] };
    const isContainer = (node.type === 'container' || node.type === 'group') && Array.isArray(node.fields);

    if (isContainer) {
      // For the outer array-item container (whose key is synthetic like 'x-container'),
      // the source record is the item itself. Nested groups/containers look up their
      // own sub-object by key when available.
      const sourceForChildren = typeof node.key === 'string' && node.key in source && source[node.key] != null && typeof source[node.key] === 'object' ? (source[node.key] as Record<string, unknown>) : source;

      result = {
        ...node,
        fields: (node.fields as unknown[]).map((child) => _withValuesFromSource(child, sourceForChildren))
      };
    } else if (typeof node.key === 'string') {
      const nextValue = source[node.key];

      if (nextValue !== undefined) {
        result = { ...node, value: nextValue };
      }
    }
  }

  return result;
}

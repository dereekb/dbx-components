/**
 * Handler naming convention enforcement for `dbx_model_api_validate_app`.
 *
 * The convention mirrors the `ModelFirebaseFunctionMap` pyramid where the
 * crud function key for `<model>.<verb>.<specifier>` resolves to the
 * camelCase concatenation `<model><Verb><Specifier>`.
 *
 * For example, given:
 * ```ts
 * abstract guestbookEntry: {
 *   updateGuestbookEntry: {
 *     insert: ModelFirebaseCrudFunction<InsertGuestbookEntryParams>;
 *   };
 *   deleteGuestbookEntry: ModelFirebaseCrudFunction<GuestbookEntryParams>;
 * };
 * ```
 *
 * The accepted handler names are:
 *  - `guestbookEntry.update.insert` → `guestbookEntryUpdateInsert` (preferred)
 *    or `guestbookEntryInsert` (shorthand, verb omitted).
 *  - `guestbookEntry.delete` (no specifier) → `guestbookEntryDelete`.
 *  - `profile.update._` (default specifier) → `profileUpdate`.
 */

import type { CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import type { HandlerEntry, ValidateIssue } from './types.js';

/**
 * Returns the accepted handler names for a given CRUD cell.
 *
 * @param model - CamelCase model key as it appears in the verb-map.
 * @param verb - CRUD verb the handler is registered under.
 * @param specifier - Specifier under the verb-map (or `undefined` / `_` for the bare handler).
 * @returns Ordered list of accepted names, with the canonical form first.
 */
export function expectedHandlerNames(model: string, verb: CrudVerb, specifier: string | undefined): readonly string[] {
  const modelCamel = lowerFirst(model);
  const verbCap = capitalize(verb);
  if (specifier === undefined || specifier === '_') {
    return [modelCamel + verbCap];
  }
  const specifierCap = capitalize(specifier);
  return [modelCamel + verbCap + specifierCap, modelCamel + specifierCap];
}

/**
 * Returns a `HANDLER_NAMING_MISMATCH` issue when `handler.handlerName` does
 * not match any accepted form, otherwise `undefined`.
 *
 * @param handler - The discovered handler entry.
 * @returns The naming issue, or `undefined` when the name is acceptable.
 */
export function checkHandlerNaming(handler: HandlerEntry): ValidateIssue | undefined {
  const expected = expectedHandlerNames(handler.model, handler.verb, handler.specifier);
  if (expected.includes(handler.handlerName)) return undefined;
  const specifierSuffix = handler.specifier ? `.${handler.specifier}` : '';
  const accepted = expected.map((n) => `\`${n}\``).join(' or ');
  return {
    code: 'HANDLER_NAMING_MISMATCH',
    model: handler.model,
    verb: handler.verb,
    specifier: handler.specifier,
    message: `Handler \`${handler.handlerName}\` for \`${handler.model}.${handler.verb}${specifierSuffix}\` does not follow the \`<model><Verb>[<Specifier>]\` convention. Rename to ${accepted}.`,
    source: `${handler.sourceFile}:${handler.line}`
  };
}

function lowerFirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

import { type Maybe } from '@dereekb/util';
import { type OpenRouterPromptKey } from './openrouter.type';

/**
 * Identifies a message template.
 *
 * A stored template IS a prompt (its `OpenRouterPrompt` carries a template type), so the two share one key space. A code
 * template's key is disjoint from every stored one.
 */
export type OpenRouterTemplateKey = OpenRouterPromptKey;

/**
 * Identifies a template TYPE registered in code. See `OpenRouterTemplateTypeConfig`.
 */
export type OpenRouterTemplateTypeKey = string;

/**
 * How a template turns its input into message text. Fixed per template type, in code, and enforced at publish and at render.
 */
export enum OpenRouterTemplateMode {
  /**
   * The body (a script or a code render function) returns the text. No model is ever called.
   */
  DETERMINISTIC = 'deterministic',
  /**
   * The body returns OpenRouter details, and the model call those details feed produces the text.
   */
  DETERMINISTIC_OPENROUTER = 'deterministic_openrouter',
  /**
   * The body returns either the text, or OpenRouter details that feed a model call. Which one is decided per render by what
   * the body returned.
   */
  DETERMINISTIC_OR_OPENROUTER = 'deterministic_or_openrouter',
  /**
   * No body. Exactly today's OpenRouter prompt call, with the caller's params passed through untouched.
   */
  OPENROUTER = 'openrouter'
}

/**
 * Which script of a template is being read or validated.
 *
 * - `body`: the first script (or code `render`), which runs on the template's context: its data, the notification it is
 *   rendered for and its accessors.
 * - `final`: the optional script (or code `finalize`) that runs after a model call and turns its output into the text.
 */
export type OpenRouterTemplateScriptPhase = 'body' | 'final';

/**
 * The details a body returns to hand a render off to the model.
 *
 * They are INPUT only: the model call uses the instructions and config stored on the same template version, so a script
 * can never choose its own model, instructions or tools.
 */
export interface OpenRouterTemplateOpenRouterDetails {
  /**
   * The input passed to the version's prompt.
   */
  readonly input: string;
}

/**
 * A body or final script result carrying the message text.
 */
export interface OpenRouterTemplateTextResult {
  readonly text: Maybe<string>;
}

/**
 * A body result that hands the render off to the model.
 */
export interface OpenRouterTemplateOpenRouterResult {
  readonly openRouter: OpenRouterTemplateOpenRouterDetails;
}

/**
 * What a body may return.
 *
 * - `string` or `{ text }`: the message text.
 * - `{ openRouter: { input } }`: OpenRouter details, in the modes that call a model.
 * - `null` / `''`: send nothing.
 */
export type OpenRouterTemplateBodyResult = Maybe<string> | OpenRouterTemplateTextResult | OpenRouterTemplateOpenRouterResult;

/**
 * What a final script may return. It cannot return OpenRouter details, so there is never a second model call.
 */
export type OpenRouterTemplateFinalResult = Maybe<string> | OpenRouterTemplateTextResult;

/**
 * A body or final script result, classified by {@link readOpenRouterTemplateBodyResult}.
 */
export type OpenRouterTemplateBodyResultRead = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'openrouter'; readonly openRouter: OpenRouterTemplateOpenRouterDetails } | { readonly kind: 'empty' };

/**
 * The kind of a classified result.
 */
export type OpenRouterTemplateBodyResultKind = OpenRouterTemplateBodyResultRead['kind'];

/**
 * Raised when a template cannot be rendered.
 *
 * The message is safe to return to an author: a script's own error is reduced to its name and message by the runner, so no
 * stack or server path leaks through it.
 */
export class OpenRouterTemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterTemplateRenderError';
  }
}

/**
 * Raised when a result is one the template type's mode does not allow, for example OpenRouter details under
 * {@link OpenRouterTemplateMode.DETERMINISTIC}.
 */
export class OpenRouterTemplateModeError extends OpenRouterTemplateRenderError {
  readonly mode: OpenRouterTemplateMode;

  constructor(message: string, mode: OpenRouterTemplateMode) {
    super(message);
    this.name = 'OpenRouterTemplateModeError';
    this.mode = mode;
  }
}

/**
 * Every mode, for validating a mode read from config.
 */
export const OPENROUTER_TEMPLATE_MODES: readonly OpenRouterTemplateMode[] = [OpenRouterTemplateMode.DETERMINISTIC, OpenRouterTemplateMode.DETERMINISTIC_OPENROUTER, OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER, OpenRouterTemplateMode.OPENROUTER];

/**
 * Whether a mode runs a body (a script or a code render function).
 *
 * @param mode - The mode to test.
 * @returns True for every mode except {@link OpenRouterTemplateMode.OPENROUTER}.
 */
export function isOpenRouterTemplateModeWithBody(mode: OpenRouterTemplateMode): boolean {
  return mode !== OpenRouterTemplateMode.OPENROUTER;
}

/**
 * Whether a mode may call a model, and so needs a model config on its version.
 *
 * @param mode - The mode to test.
 * @returns True for every mode except {@link OpenRouterTemplateMode.DETERMINISTIC}.
 */
export function isOpenRouterTemplateModeWithModel(mode: OpenRouterTemplateMode): boolean {
  return mode !== OpenRouterTemplateMode.DETERMINISTIC;
}

/**
 * Classifies a body or final script result, and refuses one the mode does not allow.
 *
 * - `null`, `undefined`, `''`, a whitespace-only string, or `{ text: null }` is `empty` (send nothing), in every mode.
 * - A string or `{ text: string }` is `text`. Refused under {@link OpenRouterTemplateMode.DETERMINISTIC_OPENROUTER}, whose
 *   body must hand off to the model.
 * - `{ openRouter: { input } }` is `openrouter`. Allowed only for a body under
 *   {@link OpenRouterTemplateMode.DETERMINISTIC_OPENROUTER} or {@link OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER}.
 *   A final script can never return it.
 * - Anything else, including an object carrying both `text` and `openRouter`, is refused.
 *
 * @param result - What the body or final script returned.
 * @param mode - The template type's mode.
 * @param phase - Which script returned it. Defaults to `body`.
 * @returns The classified result.
 * @throws {OpenRouterTemplateModeError} When the mode or phase does not allow the result.
 * @throws {OpenRouterTemplateRenderError} When the result is not one of the allowed shapes.
 */
export function readOpenRouterTemplateBodyResult(result: unknown, mode: OpenRouterTemplateMode, phase: OpenRouterTemplateScriptPhase = 'body'): OpenRouterTemplateBodyResultRead {
  let read: OpenRouterTemplateBodyResultRead;

  if (phase === 'body' && mode === OpenRouterTemplateMode.OPENROUTER) {
    throw new OpenRouterTemplateModeError('A template in OPENROUTER mode has no body to return a result.', mode);
  } else if (phase === 'final' && mode === OpenRouterTemplateMode.DETERMINISTIC) {
    throw new OpenRouterTemplateModeError('A template in DETERMINISTIC mode never calls a model, so it has no final script.', mode);
  }

  if (result == null) {
    read = { kind: 'empty' };
  } else if (typeof result === 'string') {
    read = readTextResult(result);
  } else if (typeof result === 'object' && !Array.isArray(result)) {
    const hasText = Object.hasOwn(result, 'text');
    const hasOpenRouter = Object.hasOwn(result, 'openRouter');
    const keyCount = Object.keys(result).length;

    if (hasText && !hasOpenRouter && keyCount === 1) {
      const text = (result as OpenRouterTemplateTextResult).text;

      if (text == null) {
        read = { kind: 'empty' };
      } else if (typeof text === 'string') {
        read = readTextResult(text);
      } else {
        throw new OpenRouterTemplateRenderError('A `{ text }` result must carry a string or null.');
      }
    } else if (hasOpenRouter && !hasText && keyCount === 1) {
      if (phase === 'final') {
        throw new OpenRouterTemplateModeError('A final script cannot return OpenRouter details, so there is never a second model call.', mode);
      }

      const details = (result as OpenRouterTemplateOpenRouterResult).openRouter;
      const input = details != null && typeof details === 'object' && Object.keys(details).length === 1 ? details.input : undefined;

      if (typeof input !== 'string' || input.trim() === '') {
        throw new OpenRouterTemplateRenderError('An `{ openRouter: { input } }` result must carry a non-empty string input and nothing else.');
      }

      read = { kind: 'openrouter', openRouter: { input } };
    } else {
      throw new OpenRouterTemplateRenderError('A template result must be a string, `{ text }`, `{ openRouter: { input } }` or null.');
    }
  } else {
    throw new OpenRouterTemplateRenderError('A template result must be a string, `{ text }`, `{ openRouter: { input } }` or null.');
  }

  if (read.kind === 'openrouter' && mode === OpenRouterTemplateMode.DETERMINISTIC) {
    throw new OpenRouterTemplateModeError('A template in DETERMINISTIC mode cannot hand off to the model.', mode);
  } else if (read.kind === 'text' && phase === 'body' && mode === OpenRouterTemplateMode.DETERMINISTIC_OPENROUTER) {
    throw new OpenRouterTemplateModeError('A template in DETERMINISTIC_OPENROUTER mode must return OpenRouter details or nothing, not text.', mode);
  }

  return read;
}

function readTextResult(text: string): OpenRouterTemplateBodyResultRead {
  return text.trim() === '' ? { kind: 'empty' } : { kind: 'text', text };
}

// MARK: Names
/**
 * The only free names a template script may reference.
 *
 * `undefined` is deliberately absent: use `null` or `??`.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_GLOBALS: readonly string[] = ['context', 'Math', 'JSON', 'Number', 'String', 'Array', 'Boolean'];

/**
 * The built-in members a template script may use, by the value that owns them.
 *
 * This is part of the security boundary. Adding a name here is a reviewed code change, never configuration.
 *
 * Known limitation: without a VM, string `+` and `concat` can still grow a value exponentially in code size (doubling
 * assignments). Such a script fails with a `RangeError` at the engine's string limit; the approval and review steps, and the
 * admin-only upload, are what keep one from being published.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS = {
  string: ['length', 'toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd', 'slice', 'substring', 'split', 'startsWith', 'endsWith', 'includes', 'indexOf', 'replace', 'replaceAll', 'charAt', 'at', 'concat'],
  number: ['toFixed'],
  array: ['length', 'map', 'filter', 'find', 'some', 'every', 'includes', 'indexOf', 'join', 'slice', 'concat', 'at', 'reduce'],
  Math: ['round', 'floor', 'ceil', 'min', 'max', 'abs'],
  Number: ['isFinite', 'isInteger'],
  Array: ['isArray'],
  JSON: ['stringify']
} as const;

/**
 * Every built-in member name, flattened.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES: ReadonlySet<string> = new Set(Object.values(OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS).flat());

/**
 * The built-in members that are properties rather than methods, and so may be read as values.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES: ReadonlySet<string> = new Set(['length']);

/**
 * The built-in methods whose FIRST argument is a callback.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_FIRST_ARGUMENT_CALLBACK_METHODS: ReadonlySet<string> = new Set(['map', 'filter', 'find', 'some', 'every', 'reduce']);

/**
 * The built-in methods whose SECOND argument may be a callback.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_SECOND_ARGUMENT_CALLBACK_METHODS: ReadonlySet<string> = new Set(['replace', 'replaceAll']);

/**
 * Names that are refused wherever they appear in a script — as a member, an object key, a pattern key or a binding — and
 * that no data-shape field or accessor may be named.
 *
 * The first group is the decided set. The second reaches reflection or engine hooks.
 */
export const OPENROUTER_TEMPLATE_BANNED_NAMES: ReadonlySet<string> = new Set(['constructor', 'prototype', '__proto__', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', 'call', 'apply', 'bind', 'toString', 'valueOf', 'toJSON', 'then', 'caller', 'callee', 'arguments', 'eval']);

/**
 * Members deliberately left out of {@link OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS}: ones that amplify size or mutate,
 * and obfuscation or reflection helpers.
 *
 * Listed so the exclusion is visible and tested, not because the validator needs it — a method that is not allowlisted can
 * never be called.
 */
export const OPENROUTER_TEMPLATE_EXCLUDED_MEMBER_NAMES: readonly string[] = ['repeat', 'padStart', 'padEnd', 'fill', 'sort', 'reverse', 'splice', 'push', 'from', 'of', 'fromCharCode', 'fromCodePoint', 'raw', 'parse'];

/**
 * Matches a valid accessor name: a plain camelCase name such as `profile` or `upcomingJobs`.
 */
export const OPENROUTER_TEMPLATE_ACCESSOR_NAME_REGEX = /^[a-z][A-Za-z0-9]*$/;

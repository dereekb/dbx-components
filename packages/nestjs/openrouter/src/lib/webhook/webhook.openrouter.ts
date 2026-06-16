import { type HandlerBindAccessor, type HandlerMappedSetFunction, type HandlerMappedSetFunctionFactory, type Handler, type Maybe, catchAllHandlerKey, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { type OpenRouterGenerationId, type OpenRouterModelId } from '../openrouter.type';

// MARK: OTLP Payload
/**
 * An OTLP `AnyValue`. Only the variants OpenRouter emits are modeled; integer values arrive as
 * JSON strings per the OTLP/JSON encoding.
 */
export interface OpenRouterAnyValue {
  readonly stringValue?: Maybe<string>;
  readonly boolValue?: Maybe<boolean>;
  readonly intValue?: Maybe<string | number>;
  readonly doubleValue?: Maybe<number>;
  readonly arrayValue?: Maybe<{ readonly values: OpenRouterAnyValue[] }>;
  readonly kvlistValue?: Maybe<{ readonly values: OpenRouterKeyValue[] }>;
  readonly bytesValue?: Maybe<string>;
}

/**
 * An OTLP key/value attribute pair.
 */
export interface OpenRouterKeyValue {
  readonly key: string;
  readonly value: OpenRouterAnyValue;
}

/**
 * A single OTLP span from a broadcast trace.
 */
export interface OpenRouterSpan {
  readonly traceId?: Maybe<string>;
  readonly spanId?: Maybe<string>;
  readonly parentSpanId?: Maybe<string>;
  readonly name?: Maybe<string>;
  readonly kind?: Maybe<number>;
  readonly startTimeUnixNano?: Maybe<string>;
  readonly endTimeUnixNano?: Maybe<string>;
  readonly attributes?: Maybe<OpenRouterKeyValue[]>;
}

export interface OpenRouterScopeSpan {
  readonly scope?: Maybe<{ readonly name?: Maybe<string>; readonly version?: Maybe<string> }>;
  readonly spans?: Maybe<OpenRouterSpan[]>;
}

export interface OpenRouterResourceSpan {
  readonly resource?: Maybe<{ readonly attributes?: Maybe<OpenRouterKeyValue[]> }>;
  readonly scopeSpans?: Maybe<OpenRouterScopeSpan[]>;
}

/**
 * The OTLP/JSON trace payload POSTed by an OpenRouter broadcast webhook.
 */
export interface OpenRouterBroadcastPayload {
  readonly resourceSpans?: Maybe<OpenRouterResourceSpan[]>;
}

// MARK: Attribute Keys
/**
 * Candidate attribute keys for the request model. OpenRouter follows the OpenTelemetry GenAI
 * semantic conventions (`gen_ai.*`).
 */
export const OPENROUTER_SPAN_ATTRIBUTE_MODEL_KEYS = ['gen_ai.request.model', 'gen_ai.response.model'];
export const OPENROUTER_SPAN_ATTRIBUTE_PROVIDER_KEYS = ['gen_ai.provider.name', 'gen_ai.system'];
export const OPENROUTER_SPAN_ATTRIBUTE_PROMPT_TOKENS_KEYS = ['gen_ai.usage.prompt_tokens', 'gen_ai.usage.input_tokens'];
export const OPENROUTER_SPAN_ATTRIBUTE_COMPLETION_TOKENS_KEYS = ['gen_ai.usage.completion_tokens', 'gen_ai.usage.output_tokens'];
export const OPENROUTER_SPAN_ATTRIBUTE_TOTAL_TOKENS_KEYS = ['gen_ai.usage.total_tokens'];
export const OPENROUTER_SPAN_ATTRIBUTE_COST_KEYS = ['gen_ai.usage.cost', 'gen_ai.response.cost'];
export const OPENROUTER_SPAN_ATTRIBUTE_GENERATION_ID_KEYS = ['gen_ai.response.id'];

// MARK: Attribute Map
/**
 * A primitive value extracted from an OTLP `AnyValue`.
 */
export type OpenRouterAttributeValue = string | number | boolean;

/**
 * A flat map of an OTLP span's attributes, keyed by attribute name.
 */
export type OpenRouterAttributeMap = Map<string, OpenRouterAttributeValue>;

/**
 * Extracts the primitive value from an OTLP `AnyValue`. Integer values encoded as strings are
 * parsed to numbers; nested array/kvlist/bytes values are ignored.
 *
 * @param value - The OTLP AnyValue to read.
 * @returns The primitive value, or undefined when none of the modeled variants are present.
 */
export function readOpenRouterAnyValue(value: Maybe<OpenRouterAnyValue>): Maybe<OpenRouterAttributeValue> {
  let result: Maybe<OpenRouterAttributeValue>;

  if (value != null) {
    if (value.stringValue != null) {
      result = value.stringValue;
    } else if (value.boolValue != null) {
      result = value.boolValue;
    } else if (value.doubleValue != null) {
      result = value.doubleValue;
    } else if (value.intValue != null) {
      result = typeof value.intValue === 'number' ? value.intValue : Number(value.intValue);
    }
  }

  return result;
}

/**
 * Builds a flat attribute map from a list of OTLP key/value pairs.
 *
 * @param attributes - The OTLP attributes to flatten.
 * @returns The attribute values indexed by name for direct lookup.
 */
export function openRouterAttributeMap(attributes: Maybe<OpenRouterKeyValue[]>): OpenRouterAttributeMap {
  const map: OpenRouterAttributeMap = new Map();

  attributes?.forEach((attribute) => {
    const value = readOpenRouterAnyValue(attribute.value);

    if (value != null) {
      map.set(attribute.key, value);
    }
  });

  return map;
}

function firstStringAttribute(map: OpenRouterAttributeMap, keys: string[]): Maybe<string> {
  let result: Maybe<string>;

  for (const key of keys) {
    const value = map.get(key);

    if (value != null) {
      result = String(value);
      break;
    }
  }

  return result;
}

function firstNumberAttribute(map: OpenRouterAttributeMap, keys: string[]): Maybe<number> {
  let result: Maybe<number>;

  for (const key of keys) {
    const value = map.get(key);

    if (value != null) {
      const asNumber = typeof value === 'number' ? value : Number(value);

      if (!Number.isNaN(asNumber)) {
        result = asNumber;
        break;
      }
    }
  }

  return result;
}

// MARK: Generation Info
/**
 * The commonly-used generation fields extracted from a broadcast span's attributes.
 */
export interface OpenRouterGenerationInfo {
  readonly generationId?: Maybe<OpenRouterGenerationId>;
  readonly model?: Maybe<OpenRouterModelId>;
  readonly provider?: Maybe<string>;
  readonly promptTokens?: Maybe<number>;
  readonly completionTokens?: Maybe<number>;
  readonly totalTokens?: Maybe<number>;
  readonly cost?: Maybe<number>;
}

/**
 * Extracts the commonly-used generation fields (model, provider, token usage, cost, generation id)
 * from a flattened attribute map.
 *
 * @param map - The flattened span attribute map.
 * @returns The extracted generation info.
 */
export function openRouterGenerationInfoFromAttributes(map: OpenRouterAttributeMap): OpenRouterGenerationInfo {
  return {
    generationId: firstStringAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_GENERATION_ID_KEYS),
    model: firstStringAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_MODEL_KEYS),
    provider: firstStringAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_PROVIDER_KEYS),
    promptTokens: firstNumberAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_PROMPT_TOKENS_KEYS),
    completionTokens: firstNumberAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_COMPLETION_TOKENS_KEYS),
    totalTokens: firstNumberAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_TOTAL_TOKENS_KEYS),
    cost: firstNumberAttribute(map, OPENROUTER_SPAN_ATTRIBUTE_COST_KEYS)
  };
}

// MARK: Broadcast Span
/**
 * The span name, used as the handler dispatch key.
 */
export type OpenRouterBroadcastSpanName = string;

/**
 * A single broadcast span paired with its flattened attributes and extracted generation info.
 */
export interface OpenRouterBroadcastSpan {
  /**
   * The raw OTLP span.
   */
  readonly span: OpenRouterSpan;
  /**
   * The span name (operation), used as the handler dispatch key.
   */
  readonly name: Maybe<OpenRouterBroadcastSpanName>;
  /**
   * The span's own attributes, flattened to a map.
   */
  readonly attributes: OpenRouterAttributeMap;
  /**
   * The resource-level attributes for the span's `resourceSpans` entry.
   */
  readonly resourceAttributes: OpenRouterAttributeMap;
  /**
   * The commonly-used generation fields extracted from the span's attributes.
   */
  readonly generation: OpenRouterGenerationInfo;
}

/**
 * Flattens a broadcast payload into a list of {@link OpenRouterBroadcastSpan}s, extracting
 * attributes and generation info from each span.
 *
 * @param payload - The OTLP broadcast payload.
 * @returns The flattened broadcast spans (empty for an empty / test-connection payload).
 */
export function openRouterBroadcastSpansFromPayload(payload: Maybe<OpenRouterBroadcastPayload>): OpenRouterBroadcastSpan[] {
  const result: OpenRouterBroadcastSpan[] = [];

  payload?.resourceSpans?.forEach((resourceSpan) => {
    const resourceAttributes = openRouterAttributeMap(resourceSpan.resource?.attributes);

    resourceSpan.scopeSpans?.forEach((scopeSpan) => {
      scopeSpan.spans?.forEach((span) => {
        const attributes = openRouterAttributeMap(span.attributes);

        result.push({
          span,
          name: span.name,
          attributes,
          resourceAttributes,
          generation: openRouterGenerationInfoFromAttributes(attributes)
        });
      });
    });
  });

  return result;
}

// MARK: Handler
export type OpenRouterEventHandler = Handler<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>;

/**
 * Creates a handler that dispatches broadcast spans by their span name.
 */
export const openRouterEventHandlerFactory = handlerFactory<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>((x) => x.name as OpenRouterBroadcastSpanName);

export type OpenRouterHandlerMappedSetFunction = HandlerMappedSetFunction<OpenRouterBroadcastSpan>;
export type OpenRouterHandlerMappedSetFunctionFactory = HandlerMappedSetFunctionFactory<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>;

/**
 * Identity map for broadcast spans, used by the handler configurer.
 *
 * @param span - The broadcast span.
 * @returns The same broadcast span.
 */
export function openRouterBroadcastSpan(span: OpenRouterBroadcastSpan): OpenRouterBroadcastSpan {
  return span;
}

export interface OpenRouterEventHandlerConfigurer extends HandlerBindAccessor<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName> {
  /**
   * Registers a handler for broadcast spans with a specific span name.
   *
   * Span names are open-ended (OpenRouter has no fixed event-type enum), so this is a factory:
   * call it with a name to obtain a setter for that name.
   *
   * @example
   * ```ts
   * configure.handleSpanName('chat')((span) => { ... });
   * ```
   */
  readonly handleSpanName: OpenRouterHandlerMappedSetFunctionFactory;
  /**
   * Registers a catch-all handler invoked for every span not matched by a name-specific handler.
   */
  readonly handleAnySpan: OpenRouterHandlerMappedSetFunction;
}

export const openRouterEventHandlerConfigurerFactory = handlerConfigurerFactory<OpenRouterEventHandlerConfigurer, OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>({
  configurerForAccessor: (accessor: HandlerBindAccessor<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>) => {
    const fnWithKey = handlerMappedSetFunctionFactory<OpenRouterBroadcastSpan, OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName>(accessor, openRouterBroadcastSpan);

    const configurer: OpenRouterEventHandlerConfigurer = {
      ...accessor,
      handleSpanName: fnWithKey,
      handleAnySpan: fnWithKey(catchAllHandlerKey())
    };

    return configurer;
  }
});

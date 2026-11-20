/**
 * The dispatcher's resolve stage — the capability's descriptor and route, the model (by the request › route ›
 * descriptor › default-tier precedence), the output controls, and the strategy the call is sent through.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorOf } from '../capability/llm.capability.descriptor';
import { type LlmModelProviderBindingMap } from '../model/config/llm.model.config.resolve';
import { type LlmCapabilityModelSource, type LlmCapabilityReasoningSource, resolveLlmCapabilityModel, resolveLlmCapabilityOutputControls, resolveLlmCapabilityProvider } from '../model/llm.model.precedence';
import { type LlmCapabilityRoute, type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmModelId, type LlmModelTierKey, type LlmReasoningConfig, type LlmStrategyId } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmStrategy } from '../strategy/llm.strategy';
import { type LlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatchStrategySelector } from './llm.dispatcher.config';

/**
 * The inputs of {@link llmDispatchStrategySelectorOf}.
 *
 * @typeParam R - The host's request type.
 */
export interface LlmDispatchStrategySelectorConfig<R extends LlmDispatchRequest = LlmDispatchRequest> {
  /**
   * A host selector — REPLACES the default policy when set.
   */
  readonly selectStrategy?: Maybe<LlmDispatchStrategySelector<R>>;
  /**
   * Per-slug provider bindings.
   */
  readonly providerByModel?: Maybe<LlmModelProviderBindingMap>;
  /**
   * The strategy of a dispatch nothing else claims.
   */
  readonly defaultStrategyId: LlmStrategyId;
}

/**
 * The dispatcher's strategy selector — the host's, else the default policy: route provider › per-slug binding ›
 * default strategy.
 *
 * @param config - The host selector, the bindings and the default strategy id.
 * @returns The selector.
 */
export function llmDispatchStrategySelectorOf<R extends LlmDispatchRequest = LlmDispatchRequest>(config: LlmDispatchStrategySelectorConfig<R>): LlmDispatchStrategySelector<R> {
  const { selectStrategy, providerByModel, defaultStrategyId } = config;
  return selectStrategy ?? ((selection) => resolveLlmCapabilityProvider({ route: selection.route, model: selection.model, bindings: providerByModel, defaultProvider: defaultStrategyId }).provider);
}

/**
 * The per-dispatcher inputs of the resolve stage, fixed at construction.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's capability descriptor type.
 */
export interface LlmDispatchResolveSetup<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  readonly strategies: LlmStrategyRegistry;
  readonly selectStrategy: LlmDispatchStrategySelector<R>;
  readonly descriptorOf: LlmCapabilityDescriptorOf<D>;
  readonly capabilityRoutes?: Maybe<LlmCompiledModelRouting>;
  readonly modelTiers: LlmModelTierMap;
  readonly defaultTier: LlmModelTierKey;
  /**
   * The cap a dispatch sends when no route, descriptor or tier names one.
   */
  readonly defaultMaxOutputTokens: number;
  readonly reasoningDefault: LlmReasoningConfig;
}

/**
 * The inputs of {@link resolveLlmDispatch}.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's capability descriptor type.
 */
export interface ResolveLlmDispatchConfig<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The dispatcher's resolve setup.
   */
  readonly setup: LlmDispatchResolveSetup<R, D>;
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The dispatch's call context — the route breadcrumbs land here.
   */
  readonly callContext: LlmCallContext;
}

/**
 * What the resolve stage decided.
 *
 * @typeParam D - The host's capability descriptor type.
 */
export interface LlmResolvedDispatch<D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The capability's descriptor (looked up ONCE per dispatch), when registered.
   */
  readonly descriptor: Maybe<D>;
  /**
   * The capability's route, when configured.
   */
  readonly route?: LlmCapabilityRoute;
  /**
   * The resolved tier, when the model came from one.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The resolved, concrete slug — the wire model every request of the dispatch names.
   */
  readonly resolvedModel: LlmModelId;
  /**
   * Where the model came from.
   */
  readonly modelSource: LlmCapabilityModelSource;
  /**
   * The completion cap every request of the dispatch sends — the route › descriptor › tier cap, else the setup's
   * `defaultMaxOutputTokens`. The retry ladder raises from it.
   */
  readonly maxOutputTokens: number;
  /**
   * The resolved reasoning.
   */
  readonly reasoning: LlmReasoningConfig;
  /**
   * Where the reasoning came from.
   */
  readonly reasoningSource: LlmCapabilityReasoningSource;
  /**
   * The selected strategy id.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The selected strategy.
   */
  readonly strategy: LlmStrategy;
}

/**
 * Resolve one dispatch: descriptor and route, model, output controls (the cap falls back to the setup's
 * `defaultMaxOutputTokens`), strategy. An unregistered strategy id throws, naming the registered ones. Files the `model-route`, `provider-route`
 * and (when reasoning resolved off) `reasoning-floor` breadcrumbs, each once per its key.
 *
 * @param config - The setup, the request and the call context.
 * @returns The resolved dispatch.
 * @throws {Error} When the selected strategy id is not registered.
 */
export function resolveLlmDispatch<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: ResolveLlmDispatchConfig<R, D>): LlmResolvedDispatch<D> {
  const { setup, request, callContext } = config;
  const { strategies, selectStrategy, modelTiers: tiers, defaultTier, defaultMaxOutputTokens, reasoningDefault } = setup;
  const capability = request.capability;
  const descriptor = setup.descriptorOf(capability);
  const route = setup.capabilityRoutes?.get(capability);
  // the request itself is the per-call override: it carries `model?` / `tier?` (the decision lane passes its request too)
  const resolved = resolveLlmCapabilityModel({ override: request, descriptor, route, tiers, defaultTier });
  const { model: resolvedModel, tier, source: modelSource } = resolved;
  callContext.diag({ level: 'debug', code: 'model-route', fields: { capability, model: resolvedModel, ...(tier == null ? {} : { tier }), source: modelSource }, message: 'capability model resolved by the precedence ladder', once: `model-route:${capability}` });

  const strategyId = selectStrategy({ request, capability, model: resolvedModel, ...(tier == null ? {} : { tier }), ...(route == null ? {} : { route }) });
  const strategy = strategies.get(strategyId);

  if (strategy == null) {
    throw new Error(`llm dispatcher: no LLM strategy registered for '${strategyId}' (routing ${capability} on model '${resolvedModel}'; registered: ${strategies.keys().join(', ') || 'none'}).`);
  }

  callContext.diag({ level: 'debug', code: 'provider-route', fields: { capability, model: resolvedModel, provider: strategyId }, message: 'provider instance resolved for this dispatch', once: `provider-route:${capability}:${resolvedModel}` });
  const { maxOutputTokens: namedMaxOutputTokens, reasoning, reasoningSource } = resolveLlmCapabilityOutputControls({ descriptor, route, tier, tiers, reasoningDefault, requestReasoning: request.reasoning });

  if (reasoning.enabled === false) {
    callContext.diag({ level: 'debug', code: 'reasoning-floor', fields: { capability, source: reasoningSource }, message: 'reasoning resolved off for this dispatch', once: `reasoning-floor:${capability}` });
  }

  return {
    descriptor,
    ...(route == null ? {} : { route }),
    ...(tier == null ? {} : { tier }),
    resolvedModel,
    modelSource,
    maxOutputTokens: namedMaxOutputTokens ?? defaultMaxOutputTokens,
    reasoning,
    reasoningSource,
    strategyId,
    strategy
  };
}

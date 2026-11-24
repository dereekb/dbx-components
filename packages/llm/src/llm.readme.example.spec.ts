/**
 * Runs the README's `## Quick start` example statement for statement — change the two together.
 *
 * The one difference is the root import: the README imports `'@dereekb/llm'`, and this spec imports the same barrel
 * relatively (`'./index'`), because a project may not import itself by its package name.
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmScriptedStrategy } from '@dereekb/llm/test';
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, defineLlmCapability, makeLlmDispatcher, makeLlmSchemaValueValidator, makeLlmStrategyRegistry, makeLlmTieredPromptTemplateResolver, readLlmCallPrompt, readLlmReplyValue, toLlmCallLogPayload, type LlmCallLogPayloadWrite, type LlmCapabilityDescriptor } from './index';

describe('README quick start: define a capability and dispatch it', () => {
  it('dispatches the capability through the scripted strategy and records the flat row', async () => {
    // 1. The capability: its key, the reply schema, and how a parsed reply becomes a typed value.
    const summarySchema = type({ summary: 'string' });
    const SUMMARIZE = defineLlmCapability({
      capability: 'summarize',
      responseSchema: summarySchema,
      parseValue: (value) => {
        const out = summarySchema(value);
        return out instanceof type.errors ? undefined : out;
      }
    });
    const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { summarize: SUMMARIZE };

    // 2. Its text: templates are keyed by role and scoped by capability, apart from the descriptor.
    const templateResolver = makeLlmTieredPromptTemplateResolver({
      tiers: [{ source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize the subject in one sentence.' }] }]
    });

    // 3. A strategy: `/test`'s scripted one here; a provider strategy in an app (docs/node.md).
    const strategy = makeLlmScriptedStrategy({ byCapability: { summarize: '{"summary":"A brass desk lamp."}' } });

    // 4. The dispatcher. The recorder persists the flat row, never the in-memory record.
    const rows: LlmCallLogPayloadWrite[] = [];
    const dispatcher = makeLlmDispatcher({
      strategies: makeLlmStrategyRegistry([strategy]),
      defaultStrategyId: strategy.id,
      defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
      modelTiers: { fast: 'acme/fast' },
      descriptorOf: (capability) => DESCRIPTORS[capability],
      templateResolver,
      recorder: {
        recordCall: (record) => {
          rows.push(toLlmCallLogPayload(record, { keepIo: true })); // keepIo keeps the prompt and the reply (a tape replays them)
        }
      }
    });

    // 5. Dispatch, then read the typed value.
    const result = await dispatcher.dispatch({
      capability: 'summarize',
      renderLiveContext: () => [{ key: 'subject', text: 'Subject: a brass desk lamp' }],
      validate: makeLlmSchemaValueValidator(summarySchema)
    });

    const summary = SUMMARIZE.parseValue(readLlmReplyValue(result.text)); // { summary: 'A brass desk lamp.' }

    // What the README shows, observed.
    expect(summary).toEqual({ summary: 'A brass desk lamp.' });
    expect(result.decodeStatus).toBe('clean');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ capability: 'summarize', strategyId: 'scripted', model: 'acme/fast' });

    // The resolver's template, the live context and the output contract all reached the prompt bytes.
    const prompt = readLlmCallPrompt(rows[0]);
    expect(prompt).toContain('Summarize the subject in one sentence.');
    expect(prompt).toContain('Subject: a brass desk lamp');
    expect(prompt).toContain('## Output contract');
  });
});

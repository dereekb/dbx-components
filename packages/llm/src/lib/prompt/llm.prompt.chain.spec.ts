import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { type LlmValueValidator } from '../reply/llm.reply.validator';
import { DEFAULT_LLM_PROMPT_CHAIN_LEAD, makeLlmPromptChain } from './llm.prompt.chain';
import { joinLlmLiveContextBlocks, LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD, LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD, type LlmLiveContextBlock } from './llm.prompt.live.context';
import { withLlmPromptSite } from './llm.prompt.site';
import { type LlmPromptRunParams, makeLlmPromptFactory } from './llm.prompt.thread';

const LEAD = DEFAULT_LLM_PROMPT_CHAIN_LEAD;
const UNCHANGED = LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD;

/**
 * A fake dispatcher over a canned reply: a root sends its joined live context as the user turn, a follow-up its
 * content.
 */
function fakeDispatcherOf(reply: string) {
  const dispatched: string[] = [];
  const runs: LlmPromptRunParams<LlmDispatchRequest>[] = [];
  const preparePrompt = makeLlmPromptFactory<LlmDispatchRequest>({
    runPromptRequest: async (params) => {
      const { request, followUp } = params;
      runs.push(params);
      dispatched.push(request.capability);
      const content = followUp == null ? joinLlmLiveContextBlocks(request.renderLiveContext()) : followUp.content;
      return { result: { text: reply, strategyId: 'fake', capability: request.capability }, sentTurn: { role: 'user', content } };
    }
  });
  const dispatcher: LlmDispatcher = { dispatch: async (request) => (await preparePrompt(request).execute()).result, preparePrompt };
  return { dispatcher, dispatched, runs };
}

const blocksRequest = (capability: string, blocks: ReadonlyArray<LlmLiveContextBlock>, extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest => ({ capability, renderLiveContext: () => blocks, ...extra });

describe('makeLlmPromptChain(); ported', () => {
  it('dispatches a fresh root when there is no previous', async () => {
    const { dispatcher, dispatched } = fakeDispatcherOf('root-reply');
    const chain = makeLlmPromptChain();

    const executed = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', [{ key: 'd', text: 'D-ROOT' }]) });

    expect(executed.result.text).toBe('root-reply');
    expect(dispatched).toEqual(['summarize']);
    expect(executed.thread.map((turn) => turn.content)).toEqual(['D-ROOT', 'root-reply']);
  });

  it('chains a follow-up onto previous with the lead and the live context', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain();
    const root = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', [{ key: 'd', text: 'D-ROOT' }]) });

    const second = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', [{ key: 'd', text: 'D-ITEM-2' }]), previous: root });

    expect(second.thread.map((turn) => turn.content)).toEqual(['D-ROOT', 'reply', `${LEAD}\n\nD-ITEM-2`, 'reply']);
  });

  it('sends a follow-up only the blocks whose bytes changed, naming the unchanged ones', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain();
    const items = (room: string, item: string): ReadonlyArray<LlmLiveContextBlock> => [
      { key: 'members', text: 'MEMBERS' },
      { key: 'room', text: room },
      { key: 'item', text: item }
    ];
    const root = await chain.dispatch({ dispatcher, request: blocksRequest('extract', items('ROOM-1', 'ITEM-1')) });

    const second = await chain.dispatch({ dispatcher, request: blocksRequest('extract', items('ROOM-2', 'ITEM-2')), previous: root });
    expect(second.thread[2]?.content).toBe(`${LEAD}\n\nROOM-2\n\nITEM-2\n\n${UNCHANGED} members.`);

    // The base advances: the third item diffs against what the SECOND sent.
    const third = await chain.dispatch({ dispatcher, request: blocksRequest('extract', items('ROOM-2', 'ITEM-3')), previous: second });
    expect(third.thread[4]?.content).toBe(`${LEAD}\n\nITEM-3\n\n${UNCHANGED} members, room.`);
  });

  it('keeps the delta base CUMULATIVE across a disjoint block set, and takes a per-call lead', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain();
    const step = (focus: string): ReadonlyArray<LlmLiveContextBlock> => [
      { key: 'goal', text: 'GOAL' },
      { key: 'focus', text: focus }
    ];
    const root = await chain.dispatch({ dispatcher, request: blocksRequest('extract', step('F1')) });
    const research = await chain.dispatch({ dispatcher, request: blocksRequest('extract', [{ key: 'research', text: 'ANSWER' }]), previous: root });
    expect(research.thread[2]?.content).toBe(`${LEAD}\n\nANSWER`);

    const next = await chain.dispatch({ dispatcher, request: blocksRequest('extract', step('F2')), previous: research, lead: 'NEXT ITEM:' });
    expect(next.thread[4]?.content).toBe(`NEXT ITEM:\n\nF2\n\n${UNCHANGED} goal.`);
  });
});

describe('makeLlmPromptChain(); the instance', () => {
  const root = [{ key: 'd', text: 'D-ROOT' }];
  const item = [{ key: 'd', text: 'D-ITEM' }];

  it("replaces the default with the instance's configured lead", async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain({ lead: 'CONTINUE:' });
    const first = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', root) });
    const second = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', item), previous: first });
    expect(second.thread[2]?.content).toBe('CONTINUE:\n\nD-ITEM');
  });

  it("lets a per-call lead beat the instance's", async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain({ lead: 'CONTINUE:' });
    const first = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', root) });
    const second = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', item), previous: first, lead: 'AGAIN:' });
    expect(second.thread[2]?.content).toBe('AGAIN:\n\nD-ITEM');
  });

  it('sends the body alone for an empty lead', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain({ lead: '' });
    const first = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', root) });
    const second = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', item), previous: first });
    expect(second.thread[2]?.content).toBe('D-ITEM');
  });

  it('never shares a base between two instances', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const a = makeLlmPromptChain();
    const b = makeLlmPromptChain();
    const blocks = (item: string): ReadonlyArray<LlmLiveContextBlock> => [
      { key: 'members', text: 'MEMBERS' },
      { key: 'item', text: item }
    ];
    const first = await a.dispatch({ dispatcher, request: blocksRequest('summarize', blocks('ITEM-1')) });

    const throughA = await a.dispatch({ dispatcher, request: blocksRequest('summarize', blocks('ITEM-2')), previous: first });
    const throughB = await b.dispatch({ dispatcher, request: blocksRequest('summarize', blocks('ITEM-2')), previous: first });

    expect(throughA.thread[2]?.content).toBe(`${LEAD}\n\nITEM-2\n\n${UNCHANGED} members.`);
    expect(throughB.thread[2]?.content).toBe(`${LEAD}\n\nMEMBERS\n\nITEM-2`);
  });

  it('names a block the previous item showed and this one does not', async () => {
    const { dispatcher } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain();
    const first = await chain.dispatch({
      dispatcher,
      request: blocksRequest('summarize', [
        { key: 'status', text: 'S1' },
        { key: 'alert', text: 'ALERT' }
      ])
    });

    const second = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', [{ key: 'status', text: 'S2' }]), previous: first });

    expect(second.thread[2]?.content).toBe(`${LEAD}\n\nS2\n\n${LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD} alert.`);
  });

  it('carries exactly validate, maxAttempts and responseSchemaHint onto a follow-up', async () => {
    const { dispatcher, runs } = fakeDispatcherOf('reply');
    const chain = makeLlmPromptChain();
    const validate: LlmValueValidator = () => true;
    const first = await chain.dispatch({ dispatcher, request: blocksRequest('summarize', root) });

    await chain.dispatch({ dispatcher, request: blocksRequest('summarize', item, { validate, maxAttempts: 2, responseSchemaHint: { type: 'object' }, tier: 'fast', contractFooter: 'FOOTER' }), previous: first });

    expect(Object.keys(runs[1]?.followUp ?? {}).sort()).toEqual(['content', 'maxAttempts', 'responseSchemaHint', 'validate']);
    expect(runs[1]?.followUp?.validate).toBe(validate);
  });

  it('leaves no base when the root run never renders its live context', async () => {
    const preparePrompt = makeLlmPromptFactory<LlmDispatchRequest>({
      runPromptRequest: async ({ request, followUp }) => ({ result: { text: 'reply', strategyId: 'fake', capability: request.capability }, sentTurn: { role: 'user', content: followUp?.content ?? 'static' } })
    });
    const chain = makeLlmPromptChain();
    const first = await chain.dispatch({ dispatcher: { preparePrompt }, request: blocksRequest('summarize', [{ key: 'members', text: 'MEMBERS' }]) });

    const second = await chain.dispatch({ dispatcher: { preparePrompt }, request: blocksRequest('summarize', [{ key: 'members', text: 'MEMBERS' }]), previous: first });

    expect(second.thread[2]?.content).toBe(`${LEAD}\n\nMEMBERS`);
  });

  it('records the base of a root dispatched through a site scope, whose run sees the site', async () => {
    const { dispatcher, runs } = fakeDispatcherOf('reply');
    const scoped = withLlmPromptSite({ dispatcher, site: { kind: 'report' } });
    const chain = makeLlmPromptChain();
    const blocks = (item: string): ReadonlyArray<LlmLiveContextBlock> => [
      { key: 'members', text: 'MEMBERS' },
      { key: 'item', text: item }
    ];
    const first = await chain.dispatch({ dispatcher: scoped, request: blocksRequest('summarize', blocks('ITEM-1')) });

    const second = await chain.dispatch({ dispatcher: scoped, request: blocksRequest('summarize', blocks('ITEM-2')), previous: first });

    expect(runs[0]?.request.site).toEqual({ kind: 'report' });
    expect(second.thread[2]?.content).toBe(`${LEAD}\n\nITEM-2\n\n${UNCHANGED} members.`);
  });
});

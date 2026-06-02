import { DEFAULT_VOID_MCP_SUCCESS_VALUE, formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { type OnCallInvokeModelParams } from '@dereekb/firebase';
import { type McpToolResponseContext } from '@dereekb/firebase-server';

const PARAMS: OnCallInvokeModelParams = {
  call: 'invoke',
  modelType: 'storageFile',
  specifier: 'recomputeChecksums',
  data: { foo: 1 }
};

describe('formatMcpToolResponse', () => {
  it('Tier 1: stringifies the result as JSON when no formatter is configured', async () => {
    const response = await formatMcpToolResponse({ ran: true }, PARAMS, undefined);
    expect(response.content).toEqual([{ type: 'text', text: JSON.stringify({ ran: true }, null, 2) }]);
    expect(response.structuredContent).toEqual({ ran: true });
    expect(response.isError).toBeUndefined();
  });

  it('Tier 1: coerces undefined to the default void-success value', async () => {
    const response = await formatMcpToolResponse(undefined, PARAMS, {});
    expect(response.content[0]).toEqual({ type: 'text', text: JSON.stringify(DEFAULT_VOID_MCP_SUCCESS_VALUE) });
    expect(response.structuredContent).toBe(DEFAULT_VOID_MCP_SUCCESS_VALUE);
  });

  it('Tier 1: passes string results through unchanged', async () => {
    const response = await formatMcpToolResponse('hello', PARAMS, {});
    expect(response.content[0]).toEqual({ type: 'text', text: 'hello' });
  });

  it('Tier 2: wraps the summarizeResponse output and exposes the value as structuredContent', async () => {
    const summarizeResponse = (value: unknown, context: McpToolResponseContext) => `summary for ${context.params.modelType}: ${(value as { ran: boolean }).ran}`;
    const response = await formatMcpToolResponse({ ran: true }, PARAMS, { mcp: { summarizeResponse } });
    expect(response.content).toEqual([{ type: 'text', text: 'summary for storageFile: true' }]);
    expect(response.structuredContent).toEqual({ ran: true });
  });

  it('Tier 3: returns the formatResponse output verbatim', async () => {
    const formatted = { content: [{ type: 'text', text: 'custom!' }], structuredContent: { x: 1 }, isError: false };
    const formatResponse = () => formatted;
    const response = await formatMcpToolResponse({ ran: true }, PARAMS, { mcp: { formatResponse } });
    expect(response).toBe(formatted);
  });

  it('prefers Tier 3 over Tier 2 when both are set', async () => {
    const formatted = { content: [{ type: 'text', text: 'tier3' }] };
    const response = await formatMcpToolResponse({ ran: true }, PARAMS, {
      mcp: {
        summarizeResponse: () => 'tier2',
        formatResponse: () => formatted
      }
    });
    expect(response).toBe(formatted);
  });

  describe('mapSuccessfulResult', () => {
    it('maps the value before the default path: structuredContent and the stringified text use the mapped value', async () => {
      const mapSuccessfulResult = (result: unknown) => ({ count: (result as { entries: number[] }).entries.length });
      const response = await formatMcpToolResponse({ entries: [1, 2, 3], secret: 'hidden' }, PARAMS, { mcp: { mapSuccessfulResult } });
      expect(response.content).toEqual([{ type: 'text', text: JSON.stringify({ count: 3 }, null, 2) }]);
      expect(response.structuredContent).toEqual({ count: 3 });
    });

    it('awaits an async mapper', async () => {
      const mapSuccessfulResult = async (result: unknown) => ({ doubled: (result as { n: number }).n * 2 });
      const response = await formatMcpToolResponse({ n: 21 }, PARAMS, { mcp: { mapSuccessfulResult } });
      expect(response.structuredContent).toEqual({ doubled: 42 });
    });

    it('passes the mapped value as the first arg and exposes both raw + mapped via context', async () => {
      let seen: { value: unknown; context: McpToolResponseContext } | undefined;
      const formatted = { content: [{ type: 'text', text: 'ok' }] };
      const response = await formatMcpToolResponse({ entries: [1, 2], secret: 'hidden' }, PARAMS, {
        mcp: {
          mapSuccessfulResult: (result: unknown) => ({ count: (result as { entries: number[] }).entries.length }),
          formatResponse: (value, context) => {
            seen = { value, context };
            return formatted;
          }
        }
      });
      expect(response).toBe(formatted);
      expect(seen?.value).toEqual({ count: 2 });
      expect(seen?.context.value).toEqual({ count: 2 });
      expect(seen?.context.raw).toEqual({ entries: [1, 2], secret: 'hidden' });
      expect(seen?.context.params).toBe(PARAMS);
    });
  });
});

describe('formatMcpToolErrorResponse', () => {
  it('returns isError:true with the Error message', () => {
    const response = formatMcpToolErrorResponse(new Error('boom'));
    expect(response.isError).toBe(true);
    expect(response.content[0]).toEqual({ type: 'text', text: 'boom' });
  });

  it('coerces non-Error values to strings', () => {
    const response = formatMcpToolErrorResponse('plain string error');
    expect(response.isError).toBe(true);
    expect(response.content[0]).toEqual({ type: 'text', text: 'plain string error' });
  });
});

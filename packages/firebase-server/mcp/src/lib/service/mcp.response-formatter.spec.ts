import { DEFAULT_VOID_MCP_SUCCESS_VALUE, formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { type OnCallTypedModelParams, type OnCallInvokeModelParams } from '@dereekb/firebase';

const PARAMS: OnCallInvokeModelParams = {
  call: 'invoke',
  modelType: 'storageFile',
  specifier: 'recomputeChecksums',
  data: { foo: 1 }
};

describe('formatMcpToolResponse', () => {
  it('Tier 1: stringifies the result as JSON when no formatter is configured', () => {
    const response = formatMcpToolResponse({ ran: true }, PARAMS, undefined);
    expect(response.content).toEqual([{ type: 'text', text: JSON.stringify({ ran: true }, null, 2) }]);
    expect(response.structuredContent).toEqual({ ran: true });
    expect(response.isError).toBeUndefined();
  });

  it('Tier 1: coerces undefined to the default void-success value', () => {
    const response = formatMcpToolResponse(undefined, PARAMS, {});
    expect(response.content[0]).toEqual({ type: 'text', text: JSON.stringify(DEFAULT_VOID_MCP_SUCCESS_VALUE) });
    expect(response.structuredContent).toBe(DEFAULT_VOID_MCP_SUCCESS_VALUE);
  });

  it('Tier 1: passes string results through unchanged', () => {
    const response = formatMcpToolResponse('hello', PARAMS, {});
    expect(response.content[0]).toEqual({ type: 'text', text: 'hello' });
  });

  it('Tier 2: wraps the summarizeResponse output and exposes the raw result as structuredContent', () => {
    const summarizeResponse = (result: unknown, params: OnCallTypedModelParams) => `summary for ${params.modelType}: ${(result as { ran: boolean }).ran}`;
    const response = formatMcpToolResponse({ ran: true }, PARAMS, { mcp: { summarizeResponse } });
    expect(response.content).toEqual([{ type: 'text', text: 'summary for storageFile: true' }]);
    expect(response.structuredContent).toEqual({ ran: true });
  });

  it('Tier 3: returns the formatResponse output verbatim', () => {
    const formatted = { content: [{ type: 'text', text: 'custom!' }], structuredContent: { x: 1 }, isError: false };
    const formatResponse = () => formatted;
    const response = formatMcpToolResponse({ ran: true }, PARAMS, { mcp: { formatResponse } });
    expect(response).toBe(formatted);
  });

  it('prefers Tier 3 over Tier 2 when both are set', () => {
    const formatted = { content: [{ type: 'text', text: 'tier3' }] };
    const response = formatMcpToolResponse({ ran: true }, PARAMS, {
      mcp: {
        summarizeResponse: () => 'tier2',
        formatResponse: () => formatted
      }
    });
    expect(response).toBe(formatted);
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

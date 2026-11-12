import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { getDriveItem, getMessage, microsoftGraphRequest, microsoftGraphRequestAllPages, searchMessages } from './graph.api';
import { MicrosoftGraphError } from './graph.error.api';
import { microsoftGraphFactory } from './graph.factory';
import { type MicrosoftGraphContext } from './graph.config';

function testGraphContext(responses: { readonly status?: number; readonly body: unknown }[]): { readonly graphContext: MicrosoftGraphContext; readonly requests: Request[] } {
  const requests: Request[] = [];
  let index = 0;

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };

  let tokenCount = 0;
  const { graphContext } = microsoftGraphFactory({ fetchHandler })({
    accessTokenGetter: () => {
      tokenCount += 1;
      return `token-${tokenCount}`;
    }
  });

  return { graphContext, requests };
}

describe('microsoftGraphRequest()', () => {
  it('sends the bearer token from the getter on every request, against the Graph base URL', async () => {
    const { graphContext, requests } = testGraphContext([{ body: { id: 'me' } }]);
    const request = microsoftGraphRequest(graphContext);

    await request({ method: 'GET', path: '/me', query: { $select: 'id', skip: undefined } });
    await request({ method: 'GET', path: '/me' });

    expect(requests[0].url).toBe('https://graph.microsoft.com/v1.0/me?%24select=id');
    expect(requests[0].headers.get('Authorization')).toBe('Bearer token-1');
    expect(requests[1].headers.get('Authorization')).toBe('Bearer token-2');
  });

  it('surfaces a Graph error body as a MicrosoftGraphError', async () => {
    const { graphContext } = testGraphContext([{ status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } }]);
    const error = await microsoftGraphRequest(graphContext)({ method: 'GET', path: '/me/messages' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicrosoftGraphError);
    expect((error as MicrosoftGraphError).code).toBe('ErrorAccessDenied');
    expect((error as MicrosoftGraphError).status).toBe(403);
  });
});

describe('microsoftGraphRequestAllPages()', () => {
  it('follows @odata.nextLink', async () => {
    const { graphContext, requests } = testGraphContext([{ body: { value: [1, 2], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc' } }, { body: { value: [3] } }]);
    const items = await microsoftGraphRequestAllPages(graphContext)<number>({ path: '/me/messages' });

    expect(items).toEqual([1, 2, 3]);
    expect(decodeURIComponent(requests[1].url)).toBe('https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc');
  });
});

describe('mail and files helpers', () => {
  it('searchMessages quotes the search and scopes to a folder', async () => {
    const { graphContext, requests } = testGraphContext([{ body: { value: [] } }]);
    await searchMessages(graphContext)({ query: 'invoice', folder: 'inbox', top: 5 });

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/v1.0/me/mailFolders/inbox/messages');
    expect(url.searchParams.get('$search')).toBe('"invoice"');
    expect(url.searchParams.get('$top')).toBe('5');
  });

  it('getMessage asks for the requested body format', async () => {
    const { graphContext, requests } = testGraphContext([{ body: { id: 'm1' } }]);
    await getMessage(graphContext)({ id: 'm1', format: 'html' });

    expect(requests[0].headers.get('Prefer')).toBe('outlook.body-content-type="html"');
  });

  it('getDriveItem resolves by path', async () => {
    const { graphContext, requests } = testGraphContext([{ body: { id: 'f1' } }]);
    await getDriveItem(graphContext)({ path: '/Documents/Q1 report.docx' });

    expect(new URL(requests[0].url).pathname).toBe('/v1.0/me/drive/root:/Documents/Q1%20report.docx');
  });
});

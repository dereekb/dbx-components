import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { MicrosoftGraphError } from './graph.error.api';
import { microsoftGraphFactory } from './graph.factory';
import { microsoftGraphRequestRaw, microsoftGraphRequestStream } from './graph.raw.api';

function rawGraphContext(answer: () => Response) {
  const requests: Request[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return answer();
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token-1' });
  return { graphContext, requests };
}

describe('microsoftGraphRequestRaw()', () => {
  it('returns the bytes of a download without JSON-parsing them', async () => {
    // models: API:driveitem-get-content — GET /content answers 302 to a pre-authenticated URL; fetch follows it, so the handler stands in for the followed answer (live F7: the JSON client returned data: null)
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff]);
    const { graphContext, requests } = rawGraphContext(() => new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }));

    const response = await microsoftGraphRequestRaw(graphContext)({ method: 'GET', path: '/me/drive/items/f1/content' });

    expect(response.status).toBe(200);
    expect(Array.from(response.body)).toEqual(Array.from(bytes));
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.json()).toBeUndefined();
    expect(requests[0].headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('keeps the Location header of a 202 with no body', async () => {
    // models: API:driveitem-copy — 202 Accepted, empty body, the monitor URL in Location (live F6: the JSON client lost it)
    const { graphContext } = rawGraphContext(() => new Response(null, { status: 202, headers: { Location: 'https://api.onedrive.com/monitor/abc' } }));

    const response = await microsoftGraphRequestRaw(graphContext)({ method: 'POST', path: '/me/drive/items/f1/copy' });

    expect(response.status).toBe(202);
    expect(response.headers['location']).toBe('https://api.onedrive.com/monitor/abc');
    expect(response.body.length).toBe(0);
    expect(response.text()).toBe('');
  });

  it('sends a raw body with its own Content-Type in place of the JSON default', async () => {
    const { graphContext, requests } = rawGraphContext(() => new Response(JSON.stringify({ id: 'f2' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    const response = await microsoftGraphRequestRaw(graphContext)({ method: 'PUT', path: '/me/drive/root:/a.txt:/content', body: 'hello', contentType: 'text/plain' });

    expect(requests[0].headers.get('Content-Type')).toBe('text/plain');
    expect(await requests[0].text()).toBe('hello');
    expect(response.json()).toEqual({ id: 'f2' });
  });

  it('sends no Authorization header when authorize is false', async () => {
    // models: API:driveitem-createuploadsession — chunk PUTs to the session URL must not carry the bearer token
    const { graphContext, requests } = rawGraphContext(() => new Response(JSON.stringify({ nextExpectedRanges: ['5-'] }), { status: 202, headers: { 'Content-Type': 'application/json' } }));

    await microsoftGraphRequestRaw(graphContext)({ method: 'PUT', path: 'https://contoso.sharepoint.com/upload/session-1', body: new Uint8Array(5), authorize: false, headers: { 'Content-Range': 'bytes 0-4/10' } });

    expect(requests[0].headers.get('Authorization')).toBeNull();
    expect(requests[0].headers.get('Content-Range')).toBe('bytes 0-4/10');
    expect(requests[0].url).toBe('https://contoso.sharepoint.com/upload/session-1');
  });

  it('still throws a MicrosoftGraphError for a Graph error body', async () => {
    // models: API:driveitem-delete then GET — live F10 itemNotFound after a permanentDelete
    const { graphContext } = rawGraphContext(() => new Response(JSON.stringify({ error: { code: 'itemNotFound', message: 'The resource could not be found.' } }), { status: 404, headers: { 'Content-Type': 'application/json' } }));

    const error = await microsoftGraphRequestRaw(graphContext)({ method: 'GET', path: '/me/drive/items/gone/content' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicrosoftGraphError);
    expect((error as MicrosoftGraphError).code).toBe('itemNotFound');
  });
});

describe('microsoftGraphRequestStream()', () => {
  it('returns the body as an unread stream with its declared length', async () => {
    // models: API:driveitem-get-content — the followed 302 answers the bytes with a Content-Length
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const { graphContext, requests } = rawGraphContext(() => new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '6' } }));

    const response = await microsoftGraphRequestStream(graphContext)({ method: 'GET', path: '/me/drive/items/f1/content' });

    expect(response.status).toBe(200);
    expect(response.contentLength).toBe(6);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(new Uint8Array(await new Response(response.body).arrayBuffer())).toEqual(bytes);
    expect(requests[0].headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('reports no length for a content-encoded body, whose decoded size differs from Content-Length', async () => {
    const { graphContext } = rawGraphContext(() => new Response('abc', { status: 200, headers: { 'Content-Length': '99', 'Content-Encoding': 'gzip' } }));
    const response = await microsoftGraphRequestStream(graphContext)({ method: 'GET', path: '/me/messages/m1/$value' });
    expect(response.contentLength).toBeUndefined();
  });

  it('passes the caller signal through, so aborting it cancels the request', async () => {
    const { graphContext, requests } = rawGraphContext(() => new Response('x', { status: 200 }));
    const controller = new AbortController();

    await microsoftGraphRequestStream(graphContext)({ method: 'GET', path: '/me/drive/items/f1/content', signal: controller.signal });
    controller.abort();

    expect(requests[0].signal.aborted).toBe(true);
  });

  it('still throws a MicrosoftGraphError for a Graph error body', async () => {
    // models: live F10 itemNotFound
    const { graphContext } = rawGraphContext(() => new Response(JSON.stringify({ error: { code: 'itemNotFound', message: 'The resource could not be found.' } }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    const error = await microsoftGraphRequestStream(graphContext)({ method: 'GET', path: '/me/drive/items/gone/content' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MicrosoftGraphError);
  });
});

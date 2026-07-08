import { describe, it, expect, vi } from 'vitest';
import { type ZohoSignContext } from './sign.config';
import { type ZohoSignCreateDocumentFromTemplateData } from './sign';
import { type ZohoSignDocumentOperationResponse, type ZohoSignGetEmbeddedSigningUrlResponse, zohoSignCreateDocumentFromTemplate, zohoSignGetEmbeddedSigningUrl } from './sign.api';

/**
 * Builds a minimal mock {@link ZohoSignContext} whose `fetchJson` resolves to the given value,
 * so request construction can be asserted without hitting the live Zoho API.
 */
function mockZohoSignContext<T>(resolved: T) {
  const fetchJson = vi.fn().mockResolvedValue(resolved);
  const context = { fetchJson } as unknown as ZohoSignContext;
  return { context, fetchJson };
}

describe('zohoSignCreateDocumentFromTemplate()', () => {
  const templateId = '286906000001616000';
  const response: ZohoSignDocumentOperationResponse = {
    code: 0,
    message: 'success',
    status: 'success',
    requests: { request_id: 'r1', request_name: 'Employee Agreement' }
  };
  const data: ZohoSignCreateDocumentFromTemplateData = {
    request_name: 'Employee Agreement',
    actions: [{ action_type: 'SIGN', recipient_name: 'Jane Doe', recipient_email: 'jane@example.com' }]
  };

  it('should POST to the template createdocument endpoint with a url-encoded templates envelope', async () => {
    const { context, fetchJson } = mockZohoSignContext(response);

    const result = await zohoSignCreateDocumentFromTemplate(context)({ templateId, data });

    expect(result).toBe(response);
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toEqual({ url: `/templates/${templateId}/createdocument`, queryParams: { is_quicksend: 'true' } });
    expect(input.method).toBe('POST');
    expect(input.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });

    const bodyData = new URLSearchParams(input.body).get('data');
    expect(JSON.parse(bodyData as string)).toEqual({ templates: data });
  });

  it('should send is_quicksend=false when creating a draft', async () => {
    const { context, fetchJson } = mockZohoSignContext(response);

    await zohoSignCreateDocumentFromTemplate(context)({ templateId, data, isQuickSend: false });

    const [url] = fetchJson.mock.calls[0];
    expect(url).toEqual({ url: `/templates/${templateId}/createdocument`, queryParams: { is_quicksend: 'false' } });
  });
});

describe('zohoSignGetEmbeddedSigningUrl()', () => {
  it('should POST to the embedtoken endpoint with the host query param and return the sign_url response', async () => {
    const response: ZohoSignGetEmbeddedSigningUrlResponse = {
      code: 0,
      message: 'success',
      status: 'success',
      sign_url: 'https://sign.zoho.com/embed/abc'
    };
    const { context, fetchJson } = mockZohoSignContext(response);

    const result = await zohoSignGetEmbeddedSigningUrl(context)({ requestId: '12345', actionId: '67890', host: 'https://app.example.com' });

    expect(result).toBe(response);
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toEqual({ url: '/requests/12345/actions/67890/embedtoken', queryParams: { host: 'https://app.example.com' } });
    expect(input.method).toBe('POST');
    expect(input.body).toBeUndefined();
  });
});

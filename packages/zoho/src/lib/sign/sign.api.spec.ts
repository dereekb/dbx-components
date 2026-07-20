import { describe, it, expect, vi } from 'vitest';
import { type ZohoSignConfigApiUrlInput, type ZohoSignContext } from './sign.config';
import { type ZohoSignCreateDocumentFromTemplateData } from './sign';
import { type ZohoSignDocumentOperationResponse, type ZohoSignGetEmbeddedSigningUrlResponse, type ZohoSignGetTemplateResponse, type ZohoSignGetTemplatesResponse, zohoSignCreateDocumentFromTemplate, zohoSignGetEmbeddedSigningUrl, zohoSignGetTemplate, zohoSignGetTemplates } from './sign.api';

/**
 * Builds a minimal mock {@link ZohoSignContext} whose `fetchJson` resolves to the given value,
 * so request construction can be asserted without hitting the live Zoho API.
 */
function mockZohoSignContext<T>(resolved: T, apiUrl: ZohoSignConfigApiUrlInput = 'production') {
  const fetchJson = vi.fn().mockResolvedValue(resolved);
  const context = { fetchJson, config: { apiUrl } } as unknown as ZohoSignContext;
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

describe('zohoSignGetTemplate()', () => {
  const templateId = '286906000001616000';
  const response: ZohoSignGetTemplateResponse = {
    code: 0,
    message: 'success',
    status: 'success',
    templates: {
      template_id: templateId,
      template_name: 'Employee Agreement',
      actions: [{ action_id: 'a1', action_type: 'SIGN', recipient_name: 'Signer', recipient_email: 'signer@example.com', role: 'Employee' }]
    }
  };

  it('should GET the template endpoint and return the template details (including action ids)', async () => {
    const { context, fetchJson } = mockZohoSignContext(response);

    const result = await zohoSignGetTemplate(context)({ templateId });

    expect(result).toBe(response);
    expect(result.templates.actions?.[0]?.action_id).toBe('a1');
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toBe(`/templates/${templateId}`);
    expect(input.method).toBe('GET');
  });
});

describe('zohoSignGetTemplates()', () => {
  const response: ZohoSignGetTemplatesResponse = {
    code: 0,
    message: 'success',
    status: 'success',
    templates: [
      { template_id: '286906000001616000', template_name: 'Employee Agreement' },
      { template_id: '286906000001616001', template_name: 'Independent Contractor Agreement' }
    ],
    page_context: { has_more_rows: false, total_count: 2, start_index: 1, row_count: 2 }
  };

  it('should GET the templates endpoint with a page_context data query param and return the list', async () => {
    const { context, fetchJson } = mockZohoSignContext(response);

    const result = await zohoSignGetTemplates(context)({ row_count: 5 });

    expect(result).toBe(response);
    expect(result.templates).toHaveLength(2);
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const [url, input] = fetchJson.mock.calls[0];
    expect(url.url).toBe('/templates');
    expect(JSON.parse(url.queryParams.data)).toEqual({ page_context: { row_count: 5 } });
    expect(input.method).toBe('GET');
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

  it('should reject before sending when the environment enforces https but the host is not https', async () => {
    const response = { code: 0, message: 'success', status: 'success', sign_url: 'x' } as ZohoSignGetEmbeddedSigningUrlResponse;
    const { context, fetchJson } = mockZohoSignContext(response, 'production');

    await expect(zohoSignGetEmbeddedSigningUrl(context)({ requestId: '12345', actionId: '67890', host: 'http://app.example.com' })).rejects.toThrow(/https/i);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('should pass a non-https host through against the sandbox (which does not enforce https)', async () => {
    const response = { code: 0, message: 'success', status: 'success', sign_url: 'https://signsandbox.zoho.com/embed/abc' } as ZohoSignGetEmbeddedSigningUrlResponse;
    const { context, fetchJson } = mockZohoSignContext(response, 'sandbox');

    const result = await zohoSignGetEmbeddedSigningUrl(context)({ requestId: '12345', actionId: '67890', host: 'http://staging.example.com' });

    expect(result).toBe(response);
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const [url] = fetchJson.mock.calls[0];
    expect(url.queryParams.host).toBe('http://staging.example.com');
  });
});

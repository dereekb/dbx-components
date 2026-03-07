import { zohoSignConfigApiUrl } from './sign.config';
import { type ZohoSignPageContext, zohoSignFetchPageFactory } from './sign.api.page';

describe('zohoSignConfigApiUrl()', () => {
  it('should return the production URL for "production"', () => {
    const result = zohoSignConfigApiUrl('production');
    expect(result).toBe('https://sign.zoho.com/api/v1');
  });

  it('should return the sandbox URL for "sandbox"', () => {
    const result = zohoSignConfigApiUrl('sandbox');
    expect(result).toBe('https://signsandbox.zoho.com/api/v1');
  });

  it('should return a custom URL as-is', () => {
    const customUrl = 'https://custom.zoho.com/api/v1';
    const result = zohoSignConfigApiUrl(customUrl);
    expect(result).toBe(customUrl);
  });
});

describe('zohoSignFetchPageFactory()', () => {
  it('should create a page factory that advances start_index by row_count', async () => {
    const mockResults = [
      {
        requests: [{ request_id: '1' }, { request_id: '2' }],
        page_context: { has_more_rows: true, total_count: 4, start_index: 1, row_count: 2 } as ZohoSignPageContext
      },
      {
        requests: [{ request_id: '3' }, { request_id: '4' }],
        page_context: { has_more_rows: false, total_count: 4, start_index: 3, row_count: 2 } as ZohoSignPageContext
      }
    ];

    let callIndex = 0;
    const mockFetch = async (_input: { start_index?: number; row_count?: number }) => {
      const result = mockResults[callIndex];
      callIndex++;
      return result;
    };

    const pageFactory = zohoSignFetchPageFactory(mockFetch);
    const firstPage = pageFactory({ start_index: 1, row_count: 2 });

    const firstResult = await firstPage.fetchNext();
    expect(firstResult.result.requests).toHaveLength(2);
    expect(firstResult.hasNext).toBe(true);

    const secondResult = await firstResult.fetchNext();
    expect(secondResult.result.requests).toHaveLength(2);
    expect(secondResult.hasNext).toBe(false);
  });

  it('should handle empty results with has_more_rows false', async () => {
    const mockFetch = async () => ({
      requests: [],
      page_context: { has_more_rows: false, total_count: 0, start_index: 1, row_count: 20 } as ZohoSignPageContext
    });

    const pageFactory = zohoSignFetchPageFactory(mockFetch);
    const firstPage = pageFactory({ start_index: 1, row_count: 20 });

    const result = await firstPage.fetchNext();
    expect(result.result.requests).toHaveLength(0);
    expect(result.hasNext).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { ZOHO_DESK_PAGINATION_ADAPTER, ZOHO_PAGE_PAGINATION_ADAPTER, ZOHO_SIGN_PAGINATION_ADAPTER, type ZohoPaginatedResponse, type ZohoSignPaginatedResponse } from './pagination';

describe('ZOHO_PAGE_PAGINATION_ADAPTER', () => {
  describe('nextInput()', () => {
    it('should return undefined when there are no more records', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: false } };
      const result = ZOHO_PAGE_PAGINATION_ADAPTER.nextInput({ page: 1 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance to the next page when more records are available', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: true } };
      const result = ZOHO_PAGE_PAGINATION_ADAPTER.nextInput({ page: 2, foo: 'bar' }, last);
      expect(result).toEqual({ page: 3, foo: 'bar' });
    });

    it('should default the current page to 1 when not provided', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: true } };
      const result = ZOHO_PAGE_PAGINATION_ADAPTER.nextInput({}, last);
      expect(result.page).toBe(2);
    });
  });

  describe('hasMorePagesAvailable()', () => {
    it('should return true when more_records is true', () => {
      const r: ZohoPaginatedResponse = { data: [], info: { more_records: true } };
      expect(ZOHO_PAGE_PAGINATION_ADAPTER.hasMorePagesAvailable({}, r)).toBe(true);
    });

    it('should return false when more_records is false or missing', () => {
      const r: ZohoPaginatedResponse = { data: [] };
      expect(ZOHO_PAGE_PAGINATION_ADAPTER.hasMorePagesAvailable({}, r)).toBe(false);
    });
  });
});

describe('ZOHO_DESK_PAGINATION_ADAPTER', () => {
  describe('nextInput()', () => {
    it('should return undefined when limit is 0', () => {
      const last: ZohoPaginatedResponse = { data: [1, 2, 3] };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 0 }, last);
      expect(result).toBeUndefined();
    });

    it('should return undefined when fewer records than limit were returned', () => {
      const last: ZohoPaginatedResponse = { data: Array.from({ length: 5 }, () => 0) };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 10 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance by the page limit when the previous page was full', () => {
      const last: ZohoPaginatedResponse = { data: Array.from({ length: 10 }, () => 0) };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 10, from: 1 }, last);
      expect(result).toEqual({ limit: 10, from: 11 });
    });

    it('should default `from` to 1 when not provided', () => {
      const last: ZohoPaginatedResponse = { data: Array.from({ length: 10 }, () => 0) };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 10 }, last);
      expect(result.from).toBe(11);
    });
  });

  describe('hasMorePagesAvailable()', () => {
    it('should return false when limit is 0', () => {
      const r: ZohoPaginatedResponse = { data: [1, 2, 3] };
      expect(ZOHO_DESK_PAGINATION_ADAPTER.hasMorePagesAvailable({ limit: 0 }, r)).toBe(false);
    });

    it('should return false when records are fewer than the limit', () => {
      const r: ZohoPaginatedResponse = { data: Array.from({ length: 5 }, () => 0) };
      expect(ZOHO_DESK_PAGINATION_ADAPTER.hasMorePagesAvailable({ limit: 10 }, r)).toBe(false);
    });

    it('should return true when the page is fully populated', () => {
      const r: ZohoPaginatedResponse = { data: Array.from({ length: 10 }, () => 0) };
      expect(ZOHO_DESK_PAGINATION_ADAPTER.hasMorePagesAvailable({ limit: 10 }, r)).toBe(true);
    });
  });
});

describe('ZOHO_SIGN_PAGINATION_ADAPTER', () => {
  describe('nextInput()', () => {
    it('should return undefined when there are no more rows', () => {
      const last: ZohoSignPaginatedResponse = { data: [], page_context: { has_more_rows: false } };
      const result = ZOHO_SIGN_PAGINATION_ADAPTER.nextInput({ start_index: 1, row_count: 10 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance start_index by row_count when more rows are available', () => {
      const last: ZohoSignPaginatedResponse = { data: [], page_context: { has_more_rows: true } };
      const result = ZOHO_SIGN_PAGINATION_ADAPTER.nextInput({ start_index: 1, row_count: 10, foo: 'bar' }, last);
      expect(result).toEqual({ start_index: 11, row_count: 10, foo: 'bar' });
    });

    it('should default start_index to 1 and row_count to 20 when not provided', () => {
      const last: ZohoSignPaginatedResponse = { data: [], page_context: { has_more_rows: true } };
      const result = ZOHO_SIGN_PAGINATION_ADAPTER.nextInput({}, last);
      expect(result.start_index).toBe(21);
    });
  });

  describe('hasMorePagesAvailable()', () => {
    it('should return true when has_more_rows is true', () => {
      const r: ZohoSignPaginatedResponse = { data: [], page_context: { has_more_rows: true } };
      expect(ZOHO_SIGN_PAGINATION_ADAPTER.hasMorePagesAvailable({}, r)).toBe(true);
    });

    it('should return false when has_more_rows is false or page_context is missing', () => {
      expect(ZOHO_SIGN_PAGINATION_ADAPTER.hasMorePagesAvailable({}, { data: [], page_context: { has_more_rows: false } })).toBe(false);
      expect(ZOHO_SIGN_PAGINATION_ADAPTER.hasMorePagesAvailable({}, { data: [] })).toBe(false);
    });
  });
});

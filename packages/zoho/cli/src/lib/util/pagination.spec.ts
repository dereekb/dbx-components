import { describe, it, expect } from 'vitest';
import { ZOHO_DESK_PAGINATION_ADAPTER, ZOHO_PAGE_PAGINATION_ADAPTER, type ZohoPaginatedResponse } from './pagination';

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
      const last: ZohoPaginatedResponse = { data: new Array(5).fill(0) };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 10 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance by the page limit when the previous page was full', () => {
      const last: ZohoPaginatedResponse = { data: new Array(10).fill(0) };
      const result = ZOHO_DESK_PAGINATION_ADAPTER.nextInput({ limit: 10, from: 1 }, last);
      expect(result).toEqual({ limit: 10, from: 11 });
    });

    it('should default `from` to 1 when not provided', () => {
      const last: ZohoPaginatedResponse = { data: new Array(10).fill(0) };
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
      const r: ZohoPaginatedResponse = { data: new Array(5).fill(0) };
      expect(ZOHO_DESK_PAGINATION_ADAPTER.hasMorePagesAvailable({ limit: 10 }, r)).toBe(false);
    });

    it('should return true when the page is fully populated', () => {
      const r: ZohoPaginatedResponse = { data: new Array(10).fill(0) };
      expect(ZOHO_DESK_PAGINATION_ADAPTER.hasMorePagesAvailable({ limit: 10 }, r)).toBe(true);
    });
  });
});

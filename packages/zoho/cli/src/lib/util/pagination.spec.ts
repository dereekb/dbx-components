import { describe, it, expect } from 'vitest';
import { zohoDeskPaginationAdapter, zohoPagePaginationAdapter, type ZohoPaginatedResponse } from './pagination';

describe('zohoPagePaginationAdapter', () => {
  describe('nextInput()', () => {
    it('should return undefined when there are no more records', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: false } } as ZohoPaginatedResponse;
      const result = zohoPagePaginationAdapter.nextInput({ page: 1 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance to the next page when more records are available', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: true } } as ZohoPaginatedResponse;
      const result = zohoPagePaginationAdapter.nextInput({ page: 2, foo: 'bar' }, last) as { page: number; foo: string };
      expect(result).toEqual({ page: 3, foo: 'bar' });
    });

    it('should default the current page to 1 when not provided', () => {
      const last: ZohoPaginatedResponse = { data: [], info: { more_records: true } } as ZohoPaginatedResponse;
      const result = zohoPagePaginationAdapter.nextInput({}, last) as { page: number };
      expect(result.page).toBe(2);
    });
  });

  describe('hasMorePagesAvailable()', () => {
    it('should return true when more_records is true', () => {
      const r: ZohoPaginatedResponse = { data: [], info: { more_records: true } } as ZohoPaginatedResponse;
      expect(zohoPagePaginationAdapter.hasMorePagesAvailable({}, r)).toBe(true);
    });

    it('should return false when more_records is false or missing', () => {
      const r: ZohoPaginatedResponse = { data: [] } as ZohoPaginatedResponse;
      expect(zohoPagePaginationAdapter.hasMorePagesAvailable({}, r)).toBe(false);
    });
  });
});

describe('zohoDeskPaginationAdapter', () => {
  describe('nextInput()', () => {
    it('should return undefined when limit is 0', () => {
      const last: ZohoPaginatedResponse = { data: [1, 2, 3] } as unknown as ZohoPaginatedResponse;
      const result = zohoDeskPaginationAdapter.nextInput({ limit: 0 }, last);
      expect(result).toBeUndefined();
    });

    it('should return undefined when fewer records than limit were returned', () => {
      const last: ZohoPaginatedResponse = { data: new Array(5).fill(0) } as unknown as ZohoPaginatedResponse;
      const result = zohoDeskPaginationAdapter.nextInput({ limit: 10 }, last);
      expect(result).toBeUndefined();
    });

    it('should advance by the page limit when the previous page was full', () => {
      const last: ZohoPaginatedResponse = { data: new Array(10).fill(0) } as unknown as ZohoPaginatedResponse;
      const result = zohoDeskPaginationAdapter.nextInput({ limit: 10, from: 1 }, last) as { from: number; limit: number };
      expect(result).toEqual({ limit: 10, from: 11 });
    });

    it('should default `from` to 1 when not provided', () => {
      const last: ZohoPaginatedResponse = { data: new Array(10).fill(0) } as unknown as ZohoPaginatedResponse;
      const result = zohoDeskPaginationAdapter.nextInput({ limit: 10 }, last) as { from: number };
      expect(result.from).toBe(11);
    });
  });

  describe('hasMorePagesAvailable()', () => {
    it('should return false when limit is 0', () => {
      const r: ZohoPaginatedResponse = { data: [1, 2, 3] } as unknown as ZohoPaginatedResponse;
      expect(zohoDeskPaginationAdapter.hasMorePagesAvailable({ limit: 0 }, r)).toBe(false);
    });

    it('should return false when records are fewer than the limit', () => {
      const r: ZohoPaginatedResponse = { data: new Array(5).fill(0) } as unknown as ZohoPaginatedResponse;
      expect(zohoDeskPaginationAdapter.hasMorePagesAvailable({ limit: 10 }, r)).toBe(false);
    });

    it('should return true when the page is fully populated', () => {
      const r: ZohoPaginatedResponse = { data: new Array(10).fill(0) } as unknown as ZohoPaginatedResponse;
      expect(zohoDeskPaginationAdapter.hasMorePagesAvailable({ limit: 10 }, r)).toBe(true);
    });
  });
});

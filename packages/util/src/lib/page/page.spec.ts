import { FINAL_PAGE, FIRST_PAGE, UNLOADED_PAGE, getNextPageNumber, getPageNumber, isFinalPage } from './page';

describe('getPageNumber()', () => {
  it('should return the page number from a page object', () => {
    expect(getPageNumber({ page: 5 })).toBe(5);
  });

  it('should return UNLOADED_PAGE when the input is null', () => {
    expect(getPageNumber(null)).toBe(UNLOADED_PAGE);
  });

  it('should return UNLOADED_PAGE when the input is undefined', () => {
    expect(getPageNumber(undefined)).toBe(UNLOADED_PAGE);
  });

  it('should return UNLOADED_PAGE when the page field is undefined', () => {
    expect(getPageNumber({})).toBe(UNLOADED_PAGE);
  });

  it('should return FIRST_PAGE for page 0', () => {
    expect(getPageNumber({ page: FIRST_PAGE })).toBe(0);
  });
});

describe('getNextPageNumber()', () => {
  it('should return the next page number', () => {
    expect(getNextPageNumber({ page: 3 })).toBe(4);
  });

  it('should return 0 when the input is null (UNLOADED_PAGE + 1)', () => {
    expect(getNextPageNumber(null)).toBe(UNLOADED_PAGE + 1);
  });
});

describe('isFinalPage()', () => {
  it('should return true when the page is FINAL_PAGE', () => {
    expect(isFinalPage({ page: FINAL_PAGE })).toBe(true);
  });

  it('should return false for a regular page number', () => {
    expect(isFinalPage({ page: 5 })).toBe(false);
  });

  it('should return false when the input is null', () => {
    expect(isFinalPage(null)).toBe(false);
  });

  it('should return false when the input is undefined', () => {
    expect(isFinalPage(undefined)).toBe(false);
  });
});

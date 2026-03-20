import { filteredPage, iterateFilteredPages } from './page.filter';

describe('filteredPage()', () => {
  it('should create a filtered page with the given page number', () => {
    const result = filteredPage(3);

    expect(result.page).toBe(3);
    expect(result.filter).toBeUndefined();
  });

  it('should copy the filter from the request', () => {
    const filter = { type: 'active' };
    const result = filteredPage(0, { filter });

    expect(result.page).toBe(0);
    expect(result.filter).toEqual(filter);
    expect(result.filter).not.toBe(filter); // should be a copy
  });

  it('should set filter to undefined when request has no filter', () => {
    const result = filteredPage(1, {} as any);

    expect(result.filter).toBeUndefined();
  });
});

describe('iterateFilteredPages()', () => {
  it('should iterate through all pages until an empty page is returned', async () => {
    const pages: number[][] = [[1, 2, 3], [4, 5], []];
    let pageIndex = 0;

    const collected: number[] = [];

    const count = await iterateFilteredPages(
      filteredPage(0),
      async () => {
        const result = pages[pageIndex] || [];
        pageIndex += 1;
        return result;
      },
      {
        use: async (value) => {
          collected.push(value);
        }
      }
    );

    expect(count).toBe(5);
    expect(collected).toEqual([1, 2, 3, 4, 5]);
  });

  it('should work with usePage callback', async () => {
    const pages: string[][] = [['a', 'b'], ['c'], []];
    let pageIndex = 0;

    const collectedPages: string[][] = [];

    const count = await iterateFilteredPages(
      filteredPage(0),
      async () => {
        const result = pages[pageIndex] || [];
        pageIndex += 1;
        return result;
      },
      {
        usePage: async (values) => {
          collectedPages.push(values);
        }
      }
    );

    expect(count).toBe(3);
    expect(collectedPages).toEqual([['a', 'b'], ['c'], []]);
  });

  it('should throw if neither use nor usePage is provided', async () => {
    await expect(iterateFilteredPages(filteredPage(0), async () => [], {})).rejects.toThrow('Neither use nor usePage was specified.');
  });

  it('should return 0 when the first page is empty', async () => {
    const count = await iterateFilteredPages(filteredPage(0), async () => [], {
      use: async () => {
        /* noop */
      }
    });

    expect(count).toBe(0);
  });

  it('should pass the filter through to the load function', async () => {
    const filter = { status: 'active' };
    const receivedFilters: any[] = [];

    await iterateFilteredPages(
      filteredPage(0, { filter }),
      async (page) => {
        receivedFilters.push(page.filter);
        return [];
      },
      {
        use: async () => {
          /* noop */
        }
      }
    );

    expect(receivedFilters.length).toBe(1);
    expect(receivedFilters[0]).toEqual(filter);
  });
});

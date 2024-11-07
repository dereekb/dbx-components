import { type PageNumber, type Page } from './page';

// MARK: PageCalculator
/**
 * @deprecated
 */
export interface PageCalculatorConfig {
  pageSize: number;
  limitKey?: string;
  skipKey?: string;
}

/**
 * Page calculation context for calculating the amount to skip/etc.
 *
 * @deprecated
 */
export class PageCalculator {
  public readonly pageSize: number;
  public readonly limitKey: string;
  public readonly skipKey: string;

  constructor(config: PageCalculatorConfig) {
    this.pageSize = config.pageSize;

    if (!this.pageSize) {
      throw new Error('Page size is required.');
    }

    this.limitKey = config.limitKey ?? 'limit';
    this.skipKey = config.skipKey ?? 'skip';
  }

  get limit() {
    return this.pageSize;
  }

  calcWithPage(page?: Page) {
    return this.calc(page?.page);
  }

  calc(page: PageNumber = 0) {
    return {
      [this.limitKey]: this.pageSize,
      [this.skipKey]: this.calcSkip(page)
    };
  }

  calcSkipWithPage(page?: Page) {
    return this.calcSkip(page?.page);
  }

  calcSkip(page: PageNumber = 0) {
    return (page ?? 0) * this.pageSize;
  }
}

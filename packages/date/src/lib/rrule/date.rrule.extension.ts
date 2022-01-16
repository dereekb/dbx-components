import { maxFutureDate } from '@dereekb/date';
import { Maybe } from '@dereekb/util';
import { RRule, Options } from 'rrule';

// TODO: Fix typings in RRule, or better yet, add the given types up to RRule.

export const DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED = 10000;

export class DateRRule extends RRule {

  last(): Maybe<Date> {
    return this._iter(new LastIterResult());
  }

  /**
   * Returns the next recurrence that occurs on/after the input date.
   */
  next(date: Date): Maybe<Date> {
    return this._iter(new NextIterResult(date));
  }

  /**
   * Returns any recurrence between the input min and max dates, if specified.
   * 
   * @param minDate 
   * @param maxDate 
   * @returns 
   */
  any(filter: { minDate?: Maybe<Date>, maxDate?: Maybe<Date> } = {}): boolean {
    return this._iter(new AnyIterResult(filter)) != null;
  }

}

/**
 * Used for typing information. Unused otherwise.
 */
abstract class BaseRRuleIter {
  readonly method = 'before';
  readonly minDate: any;
  readonly maxDate: any;
  readonly _result: any;
  readonly args: any;
  public total: number = 0;
  protected _value: Date | null = null;

  getValue(): Date | null {
    return this._value;
  }

}

/**
 * Used by DateRRule to find the last result.
 */
export class LastIterResult extends BaseRRuleIter {

  override readonly maxDate = maxFutureDate();

  constructor(readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
  }

  accept(date: Date): boolean {
    ++this.total;

    const tooLate = date > this.maxDate;

    if (tooLate) {
      return false;
    } else {
      this.add(date);
      const maxIterationReached = this.total >= this.maxIterationsAllowed;
      return !maxIterationReached;
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return true;
  }

  clone() {
    return new LastIterResult(this.maxIterationsAllowed);
  }

}

export class NextIterResult extends BaseRRuleIter {

  override readonly maxDate = this.minDate;

  constructor(override readonly minDate: Date, readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
  }

  accept(date: Date): boolean {
    this.total += 1;
    const tooEarly = this.minDate > date;

    if (tooEarly) {
      const maxIterationReached = this.total >= this.maxIterationsAllowed;
      return !maxIterationReached;
    } else {
      this.add(date);
      return false;
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  clone() {
    return new NextIterResult(this.minDate, this.maxIterationsAllowed);
  }

}

export class AnyIterResult extends BaseRRuleIter {

  override readonly minDate: Date | null = null;
  override readonly maxDate: Date | null = null;

  constructor(filter: { minDate?: Maybe<Date>, maxDate?: Maybe<Date> } = {}) {
    super();
    if (filter) {
      this.minDate = filter.minDate ?? null;
      this.maxDate = filter.maxDate ?? null;
      throw new Error('Filter is not yet supported.');
    }
  }

  accept(date: Date): boolean {
    return this.add(date);
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  clone() {
    return new AnyIterResult({ minDate: this.minDate, maxDate: this.maxDate });
  }

}

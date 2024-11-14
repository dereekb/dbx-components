import { type Maybe } from '@dereekb/util';
import { maxFutureDate } from '../date/date';
import { RRule } from 'rrule';

export interface IterArgs {
  inc: boolean;
  before: Date;
  after: Date;
  dt: Date;
  _value: Date | Date[] | null;
}

// TODO: Fix typings in RRule, or better yet, add the given types up to RRule.

export const DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED = 10000;

export class DateRRule extends RRule {
  /**
   * Returns the last occurence that occurs in the rule chain.
   *
   * @returns
   */
  last(): Maybe<Date> {
    return this._iter(new LastIterResult());
  }

  /**
   * Returns the next recurrence that occurs on/after the input date.
   *
   * @returns
   */
  next(minDate: Date): Maybe<Date> {
    return this._iter(new NextIterResult(minDate));
  }

  /**
   * Returns any recurrence between the input min and max dates, if specified.
   *
   * @param minDate
   * @param maxDate
   * @returns
   */
  any(filter: { minDate?: Maybe<Date>; maxDate?: Maybe<Date> } = {}): boolean {
    return this._iter(new AnyIterResult(filter)) != null;
  }
}

/**
 * Used for typing information. Unused otherwise.
 */
abstract class BaseRRuleIter {
  readonly method = 'before';
  readonly minDate: Date | null = undefined as unknown as Date;
  readonly maxDate: Date | null = undefined as unknown as Date;
  readonly _result: Date[] = undefined as unknown as Date[];
  readonly args: Partial<IterArgs> = undefined as unknown as Partial<IterArgs>;
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
  private readonly _maxIterationsAllowed: number;

  override readonly maxDate = maxFutureDate();

  constructor(maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
    this._maxIterationsAllowed = maxIterationsAllowed;
  }

  get maxIterationsAllowed() {
    return this._maxIterationsAllowed;
  }

  accept(date: Date): boolean {
    ++this.total;

    const tooLate = date > this.maxDate;

    if (tooLate) {
      return false;
    } else {
      this.add(date);
      const maxIterationReached = this.total >= this._maxIterationsAllowed;
      return !maxIterationReached;
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return true;
  }

  clone() {
    return new LastIterResult(this._maxIterationsAllowed);
  }
}

export class NextIterResult extends BaseRRuleIter {
  override readonly maxDate: Date;

  constructor(override readonly minDate: Date, readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
    this.maxDate = minDate;
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

  constructor(filter?: { minDate?: Maybe<Date>; maxDate?: Maybe<Date> }, readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
    if (filter) {
      this.minDate = filter.minDate ?? null;
      this.maxDate = filter.maxDate ?? null;
    }
  }

  accept(date: Date): boolean {
    ++this.total;
    const tooEarly = this.minDate != null && this.minDate > date;

    if (tooEarly) {
      const maxIterationReached = this.total >= this.maxIterationsAllowed;
      return !maxIterationReached;
    } else {
      const tooLate = this.maxDate != null && this.maxDate < date;

      if (tooLate) {
        return true;
      } else {
        this.add(date);
        return false;
      }
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  clone() {
    return new AnyIterResult({ minDate: this.minDate, maxDate: this.maxDate });
  }
}

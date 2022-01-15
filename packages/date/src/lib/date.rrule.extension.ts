import { DateUtility, TimezoneString } from './date';
import { RRule, Options } from 'rrule';

export const DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED = 10000;

export class DateRRule extends RRule {

  last(): Date {
    return this._iter(new LastIterResult());
  }

  /**
   * Returns the next recurrence that occurs on/after the input date.
   */
  next(date: Date): Date {
    return this._iter(new NextIterResult(date));
  }

  any(minDate: Date, maxDate: Date): boolean {
    return this._iter(new AnyIterResult(minDate, maxDate)) != null;
  }

}

/**
 * Used by DateRRule to find the last result.
 */
export class LastIterResult {

  readonly method = 'before';
  readonly minDate: Date;
  readonly maxDate = DateUtility.maxFutureDate();
  readonly _result: [];
  readonly args: {};

  public total: number;

  private _value: Date;

  constructor(readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) { }

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

  getValue(): Date {
    return this._value;
  }

  clone() {
    return new LastIterResult(this.maxIterationsAllowed);
  }

}

export class AnyIterResult {

  readonly method = 'before';

  readonly _result: [];
  readonly args: {};

  public total: number;

  private _value: Date;

  constructor(readonly minDate: Date, readonly maxDate: Date) { }

  accept(date: Date): boolean {
    return this.add(date);
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  getValue(): Date {
    return this._value;
  }

  clone() {
    return new AnyIterResult(this.minDate, this.maxDate);
  }

}

export class NextIterResult {

  readonly method = 'before';
  readonly maxDate = this.minDate;

  readonly _result: [];
  readonly args: {};

  public total: number;

  private _value: Date;

  constructor(readonly minDate: Date, readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) { }

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

  getValue(): Date {
    return this._value;
  }

  clone() {
    return new NextIterResult(this.minDate, this.maxIterationsAllowed);
  }

}

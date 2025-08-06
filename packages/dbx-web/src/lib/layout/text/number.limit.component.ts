import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxColorDirective, DbxThemeColor } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';

/**
 * Configuration for the DbxNumberWithLimitComponent.
 */
export interface NumberWithLimit<T extends number> {
  /**
   * Number to display, if applicable.
   */
  readonly value: T;
  /**
   * Limit to display, if applicable.
   */
  readonly limit?: Maybe<T>;
  /**
   * Function to format the input number(s) to a string before being displayed, if applicable.
   */
  readonly formatNumber?: Maybe<(number: T) => string>;
  /**
   * Prefix to add before the value
   */
  readonly prefix?: Maybe<string>;
  /**
   * Suffix to add after the value
   */
  readonly suffix?: Maybe<string>;
}

@Component({
  selector: 'dbx-number-with-limit',
  template: `
    <span class="dbx-number-with-limit" [class]="{ 'dbx-number-with-limit-rounded': rounded() }" [dbxColor]="colorSignal()">
      <span>{{ prefixSignal() }}</span>
      <span>{{ valueSignal() }}</span>
      @if (hasLimitSignal()) {
        <span class="dbx-number-with-limit-divider">/</span>
        <span>{{ limitSignal() }}</span>
      }
      <span>{{ suffixSignal() }}</span>
    </span>
  `,
  imports: [DbxColorDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxNumberWithLimitComponent<T extends number> {
  readonly number = input<NumberWithLimit<T>>();
  readonly rounded = input<boolean>();

  readonly valueSignal = computed(() => {
    const number = this.number();
    return number?.formatNumber ? number.formatNumber(number.value) : number?.value;
  });

  readonly limitSignal = computed(() => {
    const number = this.number();
    return number?.limit != null ? (number?.formatNumber ? number.formatNumber(number.limit) : number?.limit) : undefined;
  });

  readonly hasLimitSignal = computed(() => {
    return this.number()?.limit != null;
  });

  readonly prefixSignal = computed(() => {
    return this.number()?.prefix;
  });

  readonly suffixSignal = computed(() => {
    return this.number()?.suffix;
  });

  readonly colorSignal = computed(() => {
    const number = this.number();
    let color: Maybe<DbxThemeColor>;

    if (number != null) {
      const { value, limit } = number;

      if (limit != null) {
        if (value > limit) {
          color = 'warn';
        } else if (value === limit) {
          color = 'notice';
        } else {
          const ratio = limit === 0 ? 1 : value / limit;

          if (ratio > 0.8) {
            color = 'notice';
          } else {
            color = 'ok';
          }
        }
      }
    }

    return color;
  });
}

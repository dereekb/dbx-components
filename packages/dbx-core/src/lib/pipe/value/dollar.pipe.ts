import { Pipe, PipeTransform } from '@angular/core';
import { dollarAmountString, type Maybe } from '@dereekb/util';

/**
 * Pipe that takes in a number and returns the number formatted as a dollar using dollarAmountString().
 *
 * Can provide a default string value to use when the input is null or undefined.
 */
@Pipe({ name: 'dollarAmount' })
export class DollarAmountPipe implements PipeTransform {
  transform(input: Maybe<number>, defaultIfNull?: Maybe<string>): Maybe<string> {
    return defaultIfNull == null || input != null ? dollarAmountString(input) : defaultIfNull;
  }
}

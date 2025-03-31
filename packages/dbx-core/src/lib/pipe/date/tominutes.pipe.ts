import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'toMinutes',
  standalone: true,
  pure: true
})
export class ToMinutesPipe implements PipeTransform {
  transform(milliseconds: number): number {
    if (milliseconds) {
      return Math.floor(milliseconds / (60 * 1000));
    }

    return milliseconds;
  }
}

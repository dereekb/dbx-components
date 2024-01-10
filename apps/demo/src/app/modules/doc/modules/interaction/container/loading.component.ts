import { Component } from '@angular/core';
import { readableError, ReadableError } from '@dereekb/util';
import { interval, map, shareReplay } from 'rxjs';

const TEST_ERROR_CODE = 'A_VERY_LONG_TEST_ERROR_CODE_USED_FOR_REFERENCE';

@Component({
  templateUrl: './loading.component.html'
})
export class DocInteractionLoadingComponent {
  readonly loading$ = interval(1000, undefined).pipe(
    map((x) => Boolean(x % 2)),
    shareReplay(1)
  );

  readonly blankReadableError: ReadableError = {};

  readonly readableErrorWithoutCode: ReadableError = { message: 'This is an error without an error code.' };

  readonly readableError: ReadableError = readableError(TEST_ERROR_CODE, 'This is the example error message.');
}

import { Component } from '@angular/core';
import { readableError, ReadableError, serverError } from '@dereekb/util';
import { LOREM } from '../../shared/lorem';
import { CUSTOM_TEST_ERROR_CODE } from '../component/error.widget.component';

const TEST_ERROR_CODE = 'A_VERY_LONG_TEST_ERROR_CODE_USED_FOR_REFERENCE';

@Component({
  templateUrl: './error.component.html'
})
export class DocInteractionErrorComponent {
  readonly readableErrorWithoutCode: ReadableError = { message: 'This is an error without an error code.' };

  readonly readableError: ReadableError = readableError(TEST_ERROR_CODE, 'This is the example error message.');

  readonly longerReadableError: ReadableError = serverError({
    code: TEST_ERROR_CODE,
    message: LOREM,
    status: 200,
    data: {
      serverErrorDataInfo: {
        reason: 'test_reason',
        additional_info: 'The server tried its best.'
      }
    }
  });

  readonly customTestError: ReadableError = serverError({
    code: CUSTOM_TEST_ERROR_CODE,
    message: 'This error has a custom widget associated with it.',
    status: 200
  });
}

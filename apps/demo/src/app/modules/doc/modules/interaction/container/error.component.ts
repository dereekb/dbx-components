import { Component, inject } from '@angular/core';
import { Maybe, randomNumber, readableError, ReadableError, serverError } from '@dereekb/util';
import { LOREM } from '../../shared/lorem';
import { CUSTOM_ERROR_WIDGET_TEST_ERROR_CODE } from '../component/error.custom.widget.component';
import { CUSTOM_DBX_ERROR_TEST_ERROR_CODE } from '../component/error.custom.inline.widget.component';
import { DbxErrorSnackbarService } from '@dereekb/dbx-web';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxErrorComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.component';
import { DbxErrorDetailsComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.details.component';
import { DbxErrorViewComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.view.component';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';

const TEST_ERROR_CODE = 'A_VERY_LONG_TEST_ERROR_CODE_USED_FOR_REFERENCE';

@Component({
    templateUrl: './error.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxErrorComponent, DbxErrorDetailsComponent, DbxErrorViewComponent, DbxButtonComponent, DbxButtonSpacerDirective]
})
export class DocInteractionErrorComponent {
  readonly dbxErrorSnackbarService = inject(DbxErrorSnackbarService);

  readonly blankReadableError: ReadableError = {};

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

  readonly customInlineTestError: ReadableError = serverError({
    code: CUSTOM_DBX_ERROR_TEST_ERROR_CODE,
    message: 'This error has a custom dbx-error presentation/widget associated with it.',
    status: 200
  });

  readonly customWidgetTestError: ReadableError = serverError({
    code: CUSTOM_ERROR_WIDGET_TEST_ERROR_CODE,
    message: 'This error has a custom widget associated with it.',
    status: 200
  });

  showErrorSnackbar(errorNumber?: Maybe<number>) {
    if (errorNumber == null) {
      errorNumber = randomNumber(6, 'floor');
    }

    let error: ReadableError;

    switch (errorNumber) {
      case 1:
        error = this.customInlineTestError;
        break;
      case 2:
        error = this.customWidgetTestError;
        break;
      case 3:
        error = this.longerReadableError;
        break;
      case 4:
        error = this.readableErrorWithoutCode;
        break;
      case 0:
      default:
        error = this.readableError;
        break;
    }

    this.dbxErrorSnackbarService.showSnackbarError(error, { duration: 3000 });
  }
}

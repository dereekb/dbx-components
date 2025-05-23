import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxBasicLoadingComponent, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingModule, DbxLoadingProgressComponent } from '@dereekb/dbx-web';
import { readableError, ReadableError } from '@dereekb/util';
import { interval, map, shareReplay } from 'rxjs';

import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

const TEST_ERROR_CODE = 'A_VERY_LONG_TEST_ERROR_CODE_USED_FOR_REFERENCE';

@Component({
  templateUrl: './loading.component.html',
  imports: [DbxLoadingModule, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingProgressComponent, DbxBasicLoadingComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocInteractionLoadingComponent {
  readonly diameter = 32;

  readonly loading$ = interval(1000, undefined).pipe(
    map((x) => Boolean(x % 2)),
    shareReplay(1)
  );

  readonly loadingSignal = toSignal(this.loading$);

  readonly blankReadableError: ReadableError = {};

  readonly readableErrorWithoutCode: ReadableError = { message: 'This is an error without an error code.' };

  readonly readableError: ReadableError = readableError(TEST_ERROR_CODE, 'This is the example error message.');
}

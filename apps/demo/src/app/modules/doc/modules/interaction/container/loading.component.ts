import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxBasicLoadingComponent, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingModule, DbxLoadingProgressComponent } from '@dereekb/dbx-web';
import { readableError, ReadableError } from '@dereekb/util';
import { interval, map, shareReplay } from 'rxjs';

import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DEMO_WORKING_INCREASE_OBSERVABLE } from '../../shared/progress';
import { MatButtonModule } from '@angular/material/button';

const TEST_ERROR_CODE = 'A_VERY_LONG_TEST_ERROR_CODE_USED_FOR_REFERENCE';

@Component({
  templateUrl: './loading.component.html',
  imports: [DbxLoadingModule, DbxContentLayoutModule, MatButtonModule, DbxLabelBlockComponent, DbxLoadingProgressComponent, DbxBasicLoadingComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocInteractionLoadingComponent {
  private readonly _workingIncreaseSub = new SubscriptionObject();

  readonly workingPercentSignal = signal(0);

  readonly diameter = 32;

  readonly loading$ = interval(1000, undefined).pipe(
    map((x) => Boolean(x % 2)),
    shareReplay(1)
  );

  readonly loadingSignal = toSignal(this.loading$);

  readonly blankReadableError: ReadableError = {};

  readonly readableErrorWithoutCode: ReadableError = { message: 'This is an error without an error code.' };

  readonly readableError: ReadableError = readableError(TEST_ERROR_CODE, 'This is the example error message.');

  constructor() {
    this._workingIncreaseSub.subscription = DEMO_WORKING_INCREASE_OBSERVABLE.subscribe((x) => this.workingPercentSignal.set(x));
  }
}

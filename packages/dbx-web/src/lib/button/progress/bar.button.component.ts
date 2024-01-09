import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractProgressButtonDirective } from './base.progress.button.directive';
import { map, shareReplay } from 'rxjs';
import { spaceSeparatedCssClasses } from '@dereekb/util';
import { distinctUntilItemsHaveDifferentValues } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-bar-button',
  templateUrl: './bar.button.component.html',
  styleUrls: ['./bar.button.component.scss', './shared.button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxBarButtonComponent extends AbstractProgressButtonDirective {
  readonly buttonCss$ = this.baseCssClasses$.pipe(
    distinctUntilItemsHaveDifferentValues((x) => x[1]),
    map((x) => spaceSeparatedCssClasses(x[1])),
    shareReplay(1)
  );
}

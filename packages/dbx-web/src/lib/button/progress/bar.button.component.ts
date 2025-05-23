import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractProgressButtonDirective } from './abstract.progress.button.directive';
import { map, shareReplay } from 'rxjs';
import { spaceSeparatedCssClasses } from '@dereekb/util';
import { distinctUntilItemsHaveDifferentValues } from '@dereekb/rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'dbx-progress-bar-button,dbx-bar-button',
  templateUrl: './bar.button.component.html',
  styleUrls: ['./bar.button.component.scss', './shared.button.component.scss'],
  imports: [MatButtonModule, MatIconModule, MatProgressBar, NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxProgressBarButtonComponent extends AbstractProgressButtonDirective {
  readonly buttonCss$ = this.baseCssClasses$.pipe(
    distinctUntilItemsHaveDifferentValues((x) => x[1]),
    map((x) => spaceSeparatedCssClasses(x[1])),
    shareReplay(1)
  );

  readonly buttonCssSignal = toSignal(this.buttonCss$);
}

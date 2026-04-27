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
import { DbxColorDirective } from '../../layout/style/style.color.directive';

/**
 * Progress button that displays a Material progress bar beneath the button while working.
 *
 * @dbxWebComponent
 * @dbxWebSlug progress-bar-button
 * @dbxWebCategory button
 * @dbxWebRelated button, progress-spinner-button
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-progress-bar-button [config]="cfg"></dbx-progress-bar-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-progress-bar-button [config]="cfg" (btnClick)="onClick()"></dbx-progress-bar-button>
 * ```
 */
@Component({
  selector: 'dbx-progress-bar-button,dbx-bar-button',
  templateUrl: './bar.button.component.html',
  styleUrls: ['./bar.button.component.scss', './shared.button.component.scss'],
  imports: [MatButtonModule, DbxColorDirective, MatIconModule, MatProgressBar, NgClass, NgStyle],
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

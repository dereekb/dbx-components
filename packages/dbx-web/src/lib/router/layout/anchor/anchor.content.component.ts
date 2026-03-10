import { combineLatest, map, type Observable, of, shareReplay } from 'rxjs';
import { Component, inject, computed, input } from '@angular/core';
import { type ClickableAnchor, type ClickableAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';
import { MatIconModule } from '@angular/material/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Displays the icon and title from a {@link ClickableAnchorLink}, either from an explicit input or inherited from a parent {@link DbxAnchorComponent}.
 *
 * Renders a Material icon followed by a title span when available.
 *
 * @example
 * ```html
 * <dbx-anchor [anchor]="myAnchor">
 *   <dbx-anchor-content></dbx-anchor-content>
 * </dbx-anchor>
 *
 * <dbx-anchor-content [anchor]="{ icon: 'home', title: 'Home' }"></dbx-anchor-content>
 * ```
 */
@Component({
  selector: 'dbx-anchor-content',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (iconSignal()) {
      <mat-icon class="dbx-icon-spacer">{{ iconSignal() }}</mat-icon>
    }
    @if (titleSignal()) {
      <span>{{ titleSignal() }}</span>
    }
  `,
  host: {
    class: 'dbx-anchor-content'
  }
})
export class DbxAnchorContentComponent {
  readonly parent = inject(DbxAnchorComponent, { optional: true });

  readonly inputAnchor = input<Maybe<Partial<ClickableAnchorLink>>>(undefined, { alias: 'anchor' });

  private readonly _inputAnchor = toObservable(this.inputAnchor);
  private readonly _parentAnchor: Observable<Maybe<ClickableAnchor | ClickableAnchorLink>> = this.parent ? this.parent.anchor$ : of(undefined);

  readonly anchor$: Observable<Maybe<Partial<ClickableAnchorLink>>> = combineLatest([this._inputAnchor, this._parentAnchor]).pipe(
    map(([input, parent]) => input ?? parent),
    shareReplay(1)
  );

  readonly anchorSignal = toSignal(this.anchor$);

  readonly iconSignal = computed(() => this.anchorSignal()?.icon);
  readonly titleSignal = computed(() => this.anchorSignal()?.title);
}

import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import { Component, Input, OnDestroy, inject, computed, input } from '@angular/core';
import { ClickableAnchor, ClickableAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';
import { MatIconModule } from '@angular/material/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Component that displays an anchor and a span with the title.
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

import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import { Component, Input, OnDestroy, inject, computed } from '@angular/core';
import { ClickableAnchor, ClickableAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';
import { MatIcon } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Component that displays an anchor and a span with the title.
 */
@Component({
  selector: 'dbx-anchor-content',
  standalone: true,
  imports: [MatIcon],
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
export class DbxAnchorContentComponent implements OnDestroy {
  readonly parent = inject(DbxAnchorComponent, { optional: true });

  private readonly _inputAnchor = new BehaviorSubject<Maybe<Partial<ClickableAnchorLink>>>(undefined);
  private readonly _parentAnchor: Observable<Maybe<ClickableAnchor | ClickableAnchorLink>> = this.parent ? this.parent.anchor$ : of(undefined);

  readonly anchor$: Observable<Maybe<Partial<ClickableAnchorLink>>> = combineLatest([this._inputAnchor, this._parentAnchor]).pipe(
    map(([input, parent]) => input ?? parent),
    shareReplay(1)
  );

  readonly anchorSignal = toSignal(this.anchor$);

  readonly iconSignal = computed(() => this.anchorSignal()?.icon);
  readonly titleSignal = computed(() => this.anchorSignal()?.title);

  @Input()
  set anchor(anchor: Maybe<Partial<ClickableAnchorLink>>) {
    this._inputAnchor.next(anchor);
  }

  ngOnDestroy(): void {
    this._inputAnchor.complete();
  }
}

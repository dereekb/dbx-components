import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import { Component, Input, OnDestroy, inject } from '@angular/core';
import { ClickableAnchor, ClickableAnchorLink } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Component that displays an anchor and a span with the title.
 */
@Component({
  selector: 'dbx-anchor-content',
  template: `
    <mat-icon class="dbx-icon-spacer" *ngIf="icon$ | async">{{ icon$ | async }}</mat-icon>
    <span *ngIf="title$ | async">{{ title$ | async }}</span>
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

  readonly icon$ = this.anchor$.pipe(map((x) => x?.icon));
  readonly title$ = this.anchor$.pipe(map((x) => x?.title));

  @Input()
  set anchor(anchor: Maybe<Partial<ClickableAnchorLink>>) {
    this._inputAnchor.next(anchor);
  }

  ngOnDestroy(): void {
    this._inputAnchor.complete();
  }
}

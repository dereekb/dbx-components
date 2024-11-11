import { shareReplay, map, distinctUntilChanged } from 'rxjs';
import { Directive, Host, OnInit, inject } from '@angular/core';
import { isSameVector } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxMapboxLayoutComponent } from './mapbox.layout.component';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';

/**
 * Directive that synchronizes a map's virtual size with the size of the element.
 */
@Directive({
  selector: '[dbxMapboxLayoutVirtualResizeSync]'
})
export class DbxMapboxLayoutVirtualResizeSyncComponent extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxMapboxLayoutComponent = inject(DbxMapboxLayoutComponent, { host: true });

  readonly resizedVector$ = this.dbxMapboxLayoutComponent.resized$.pipe(
    map(() => {
      const element = this.dbxMapboxLayoutComponent.containerElement.nativeElement as HTMLElement;
      const { clientWidth, clientHeight } = element;
      return {
        x: clientWidth,
        y: clientHeight
      };
    }),
    distinctUntilChanged(isSameVector),
    shareReplay(1)
  );

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxMapboxLayoutComponent.dbxMapboxMapStore.setMinimumVirtualViewportSize(this.resizedVector$) ?? undefined;
  }
}

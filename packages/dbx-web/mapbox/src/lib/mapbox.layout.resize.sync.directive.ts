import { shareReplay, map, distinctUntilChanged } from 'rxjs';
import { Directive, Host, OnInit } from '@angular/core';
import { isSameVector } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxMapboxLayoutComponent } from './mapbox.layout.component';

/**
 * Directive that synchronizes a map's virtual size with the size of the element.
 */
@Directive({
  selector: '[dbxMapboxLayoutVirtualResizeSync]'
})
export class DbxMapboxLayoutVirtualResizeSyncComponent extends SubscriptionObject implements OnInit {
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

  constructor(@Host() readonly dbxMapboxLayoutComponent: DbxMapboxLayoutComponent) {
    super();
  }

  ngOnInit(): void {
    this.dbxMapboxLayoutComponent.dbxMapboxMapStore.setMinimumVirtualViewportSize(this.resizedVector$);
  }
}

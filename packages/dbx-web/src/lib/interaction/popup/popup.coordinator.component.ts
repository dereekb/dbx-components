import { DbNgxPopupController } from './popup.component';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DbNgxPopupCoordinatorService } from './popup.coordinator.service';
import { delay, map, shareReplay } from 'rxjs/operators';

/**
 * Used for coordinating popups and closing/replacing existing ones when a new popup of the same name appears.
 */
@Component({
  selector: 'dbx-popup-coordinator',
  template: `
  <ng-container *ngIf="show$ | async">
    <ng-content></ng-content>
  </ng-container>
  `,
  // TODO: styleUrls: ['./popup.scss']
})
export class DbNgxPopupCoordinatorComponent implements OnInit, OnDestroy {

  readonly isPopupForKey$ = this.service.popups$.pipe(map(x => x.get(this.popup.key) === this.popup), shareReplay(1));
  readonly show$ = this.isPopupForKey$.pipe(delay(0));

  constructor(private readonly service: DbNgxPopupCoordinatorService, private readonly popup: DbNgxPopupController) { }

  ngOnInit(): void {
    this.service.addPopup(this.popup);
  }

  ngOnDestroy(): void {
    this.service.removePopup(this.popup.key, this.popup);
  }

}

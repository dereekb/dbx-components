import { DbxPopupController } from './popup';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DbxPopupCoordinatorService } from './popup.coordinator.service';
import { delay, map, shareReplay } from 'rxjs';

/**
 * Used for coordinating popups and closing/replacing existing ones when a new popup of the same name appears.
 */
@Component({
  selector: 'dbx-popup-coordinator',
  template: `
    <ng-container *ngIf="show$ | async">
      <ng-content></ng-content>
    </ng-container>
  `
})
export class DbxPopupCoordinatorComponent implements OnInit, OnDestroy {
  readonly isPopupForKey$ = this.service.popups$.pipe(
    map((x) => x.get(this.popup.key) === this.popup),
    shareReplay(1)
  );
  readonly show$ = this.isPopupForKey$.pipe(delay(0));

  constructor(private readonly service: DbxPopupCoordinatorService, private readonly popup: DbxPopupController) {}

  ngOnInit(): void {
    this.service.addPopup(this.popup);
  }

  ngOnDestroy(): void {
    this.service.removePopup(this.popup.key, this.popup);
  }
}

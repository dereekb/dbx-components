import { DbxPopupController } from './popup';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  private readonly _service = inject(DbxPopupCoordinatorService);
  private readonly _popup = inject(DbxPopupController);

  readonly isPopupForKey$ = this._service.popups$.pipe(
    map((x) => x.get(this._popup.key) === this._popup),
    shareReplay(1)
  );
  readonly show$ = this.isPopupForKey$.pipe(delay(0));

  ngOnInit(): void {
    this._service.addPopup(this._popup);
  }

  ngOnDestroy(): void {
    this._service.removePopup(this._popup.key, this._popup);
  }
}

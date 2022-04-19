import { DbxPopupKey, DbxPopupController } from './popup';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Used for coordinating popups and closing/replacing existing ones when a new popup of the same name appears.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopupCoordinatorService implements OnDestroy {

  private _popups = new BehaviorSubject<Map<DbxPopupKey, DbxPopupController>>(new Map());

  readonly popups$ = this._popups.asObservable();

  constructor() { }

  ngOnDestroy(): void {
    this._popups.complete();
  }

  get popups(): Map<DbxPopupKey, DbxPopupController> {
    return this._popups.value;
  }

  public addPopup(popup: DbxPopupController): void {
    const key = popup.key;

    if (key) {
      this.removePopup(key);
      this._popups.value.set(key, popup);
      this._popups.next(this.popups);
    }
  }

  public removePopup(key: DbxPopupKey, popup?: DbxPopupController): void {
    if (key) {
      const existing = this.popups.get(key);

      // Remove if there is one existing, and if popup is provided it is the same popup.
      if (existing && (!popup || popup === existing)) {
        existing.close();
        this._popups.value.delete(key);
        this._popups.next(this.popups);
      }
    }
  }

}

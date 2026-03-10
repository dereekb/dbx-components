import { type DbxPopupKey, type DbxPopupController } from './popup';
import { Injectable } from '@angular/core';
import { completeOnDestroy } from '@dereekb/dbx-core';
import { BehaviorSubject } from 'rxjs';

/**
 * Root-level service that tracks active popups by key, ensuring only one popup per key exists at a time.
 *
 * When a new popup is added with a key that already exists, the previous popup is closed automatically.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopupCoordinatorService {
  private readonly _popups = completeOnDestroy(new BehaviorSubject<Map<DbxPopupKey, DbxPopupController>>(new Map()));

  readonly popups$ = this._popups.asObservable();

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

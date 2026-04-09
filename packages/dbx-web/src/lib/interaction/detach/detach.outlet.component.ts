import { Component, ChangeDetectionStrategy, ElementRef, inject, input, type OnInit, type OnDestroy, effect } from '@angular/core';
import { DBX_DETACH_DEFAULT_KEY, type DbxDetachKey } from './detach';
import { DbxDetachService } from './detach.service';

/**
 * Outlet component that displays a detached component at its DOM location.
 *
 * When this component initializes, it tells the {@link DbxDetachService} to move
 * the component for the given key into this element.
 *
 * When destroyed (e.g. navigation away), behavior depends on {@link detachOnDestroy}:
 * - `true`: the component moves to the floating overlay and remains visible
 * - `false` (default): the component stays alive in the service but is hidden until a new outlet appears
 *
 * @example
 * ```html
 * <!-- Auto-floats when navigating away -->
 * <dbx-detach-outlet key="support-chat" [detachOnDestroy]="true"></dbx-detach-outlet>
 *
 * <!-- Hidden when navigating away, re-appears when outlet is recreated -->
 * <dbx-detach-outlet key="support-chat"></dbx-detach-outlet>
 * ```
 */
@Component({
  selector: 'dbx-detach-outlet',
  template: `
    <div class="dbx-detach-outlet-content"></div>
  `,
  host: {
    class: 'dbx-detach-outlet'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDetachOutletComponent implements OnInit, OnDestroy {
  private readonly _detachService = inject(DbxDetachService);
  private readonly _elementRef = inject(ElementRef);

  readonly key = input<DbxDetachKey>(DBX_DETACH_DEFAULT_KEY);

  /**
   * When true, the component automatically moves to the floating overlay
   * when this outlet is destroyed (e.g. page navigation). Defaults to false.
   */
  readonly detachOnDestroy = input(false);

  private _currentKey?: DbxDetachKey;
  private _contentElement?: Element;

  /**
   * Re-attaches when the key input changes.
   */
  protected readonly _keyEffect = effect(() => {
    const newKey = this.key();
    if (this._currentKey && this._currentKey !== newKey) {
      this._releaseFromService(this._currentKey);
    }

    this._currentKey = newKey;
    this._attachToService(newKey);
  });

  ngOnInit(): void {
    this._contentElement = this._elementRef.nativeElement.querySelector('.dbx-detach-outlet-content');
  }

  ngOnDestroy(): void {
    if (this._currentKey && this._contentElement) {
      this._detachService.outletDestroyed(this._currentKey, this._contentElement, this.detachOnDestroy());
    }
  }

  private _attachToService(key: DbxDetachKey): void {
    if (this._contentElement) {
      this._detachService.attachToOutlet(key, this._contentElement);
    }
  }

  private _releaseFromService(key: DbxDetachKey): void {
    if (this._contentElement) {
      this._detachService.outletDestroyed(key, this._contentElement, this.detachOnDestroy());
    }
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DbxPopupController, DbxPopupWindowState, DbxPopupWindowStateType } from './popup';
import { DbxButtonModule } from '../../button/button.module';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';

/**
 * Popup Control Buttons.
 */
@Component({
  selector: 'dbx-popup-control-buttons',
  template: `
    @switch (isMinimizedSignal()) {
      @case (false) {
        <dbx-button [flat]="true" icon="minimize" (buttonClick)="minimizeClicked()"></dbx-button>
      }
      @case (true) {
        <dbx-button [flat]="true" icon="maximize" (buttonClick)="maximizeClicked()"></dbx-button>
      }
    }
    <dbx-button-spacer></dbx-button-spacer>
    @switch (isFullscreenSignal()) {
      @case (false) {
        <dbx-button [flat]="true" icon="open_in_full" (buttonClick)="fullscreenClicked()"></dbx-button>
      }
      @case (true) {
        <dbx-button [flat]="true" icon="close_fullscreen" (buttonClick)="normalscreenClicked()"></dbx-button>
      }
    }
    <dbx-button-spacer></dbx-button-spacer>
    <dbx-button [flat]="true" icon="close" color="warn" (buttonClick)="closeClicked()"></dbx-button>
  `,
  host: {
    class: 'dbx-popup-control-buttons'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxButtonModule, DbxButtonSpacerDirective],
  standalone: true
})
export class DbxPopupControlButtonsComponent {
  private readonly _appPopupController = inject(DbxPopupController);

  readonly isMinimized$ = this._appPopupController.windowState$.pipe(map((x) => x === DbxPopupWindowState.MINIMIZED));
  readonly isFullscreen$ = this._appPopupController.windowState$.pipe(map((x) => x === DbxPopupWindowState.FULLSCREEN));

  readonly isMinimizedSignal = toSignal(this.isMinimized$, { initialValue: false });
  readonly isFullscreenSignal = toSignal(this.isFullscreen$, { initialValue: false });

  minimizeClicked(): void {
    this._appPopupController.minimize();
  }

  maximizeClicked(): void {
    this._appPopupController.normalscreen();
  }

  fullscreenClicked(): void {
    this._appPopupController.fullscreen();
  }

  normalscreenClicked(): void {
    this._appPopupController.normalscreen();
  }

  closeClicked(): void {
    this._appPopupController.close();
  }
}

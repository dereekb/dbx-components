import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxDetachController, DbxDetachWindowState } from './detach';
import { DbxButtonModule } from '../../button/button.module';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';

/**
 * Renders state-dependent control buttons for a detach component.
 *
 * - ATTACHED: detach (picture_in_picture_alt) + close
 * - DETACHED: attach (open_in_full) + minimize + close
 * - MINIMIZED: attach (open_in_full) + restore (maximize) + close
 */
@Component({
  selector: 'dbx-detach-control-buttons',
  template: `
    @switch (windowStateSignal()) {
      @case ('attached') {
        <dbx-button [flat]="true" icon="picture_in_picture_alt" (buttonClick)="detachClicked()"></dbx-button>
      }
      @case ('detached') {
        <dbx-button [flat]="true" icon="open_in_full" (buttonClick)="attachClicked()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [flat]="true" icon="minimize" (buttonClick)="minimizeClicked()"></dbx-button>
      }
      @case ('minimized') {
        <dbx-button [flat]="true" icon="open_in_full" (buttonClick)="attachClicked()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [flat]="true" icon="maximize" (buttonClick)="detachClicked()"></dbx-button>
      }
    }
    <dbx-button-spacer></dbx-button-spacer>
    <dbx-button [flat]="true" icon="close" color="warn" (buttonClick)="closeClicked()"></dbx-button>
  `,
  host: {
    class: 'dbx-detach-control-buttons'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxButtonModule, DbxButtonSpacerDirective],
  standalone: true
})
export class DbxDetachControlButtonsComponent {
  private readonly _detachController = inject(DbxDetachController);

  readonly windowStateSignal = toSignal(this._detachController.windowState$, { initialValue: DbxDetachWindowState.ATTACHED });

  attachClicked(): void {
    this._detachController.attach();
  }

  detachClicked(): void {
    this._detachController.detach();
  }

  minimizeClicked(): void {
    this._detachController.minimize();
  }

  closeClicked(): void {
    this._detachController.close();
  }
}

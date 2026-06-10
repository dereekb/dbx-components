import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxPopupComponent, DbxPopupContentComponent, DbxPopupControlsComponent } from '@dereekb/dbx-web';
import { type DbxStyleDemoControls } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoControlsComponent } from './controls.component';

/**
 * Thin popup shell that renders {@link DbxFormStyleDemoControlsComponent} inside the playground's draggable popup chrome,
 * registered as the playground's controls component via `DBX_STYLE_DEMO_CONTROLS_COMPONENT` (see `provideDbxFormStyleDemo()`).
 *
 * The playground passes its {@link DbxStyleDemoControls} as the popup `data`; this component forwards it to the content
 * component, which owns the chip fields and the playground↔form sync.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-controls-popup',
  template: `
    <dbx-popup-content>
      <dbx-popup-controls header="Style Controls" controls></dbx-popup-controls>
      <div class="dbx-p3 dbx-form-style-demo-controls-popup-body">
        <dbx-form-style-demo-controls [controls]="controls" />
      </div>
    </dbx-popup-content>
  `,
  styles: [
    `
      .dbx-form-style-demo-controls-popup-body {
        max-height: 60vh;
        overflow-y: auto;
      }
    `
  ],
  standalone: true,
  imports: [DbxPopupContentComponent, DbxPopupControlsComponent, DbxFormStyleDemoControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoControlsPopupComponent {
  private readonly _popup = inject(DbxPopupComponent<void, DbxStyleDemoControls>);

  readonly controls: Maybe<DbxStyleDemoControls> = this._popup.data;
}

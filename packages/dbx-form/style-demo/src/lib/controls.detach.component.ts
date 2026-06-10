import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxDetachContentComponent, DbxDetachControlsComponent } from '@dereekb/dbx-web';
import { DbxStyleDemoControlsService } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoControlsComponent } from './controls.component';

/**
 * Detach panel that renders {@link DbxFormStyleDemoControlsComponent} inside the shared detach chrome, registered as the
 * style-demo controls component via `DBX_STYLE_DEMO_CONTROLS_COMPONENT` (see `provideDbxFormStyleDemo()`).
 *
 * `DbxStyleDemoControlsService` opens this through `DbxDetachService`, so the panel survives navigation and is available
 * app-wide. The component reads the same {@link DbxStyleDemoControlsService} instance and forwards it to the content
 * component, which owns the chip fields and the controls↔form sync.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-controls-detach',
  template: `
    <dbx-detach-content>
      <dbx-detach-controls controls header="Style Controls"></dbx-detach-controls>
      <div class="dbx-p3 dbx-form-style-demo-controls-detach-body">
        <dbx-form-style-demo-controls [controls]="controlsService" />
      </div>
    </dbx-detach-content>
  `,
  styles: [
    `
      .dbx-form-style-demo-controls-detach-body {
        max-height: 60vh;
        overflow-y: auto;
      }
    `
  ],
  standalone: true,
  imports: [DbxDetachContentComponent, DbxDetachControlsComponent, DbxFormStyleDemoControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoControlsDetachComponent {
  readonly controlsService = inject(DbxStyleDemoControlsService);
}

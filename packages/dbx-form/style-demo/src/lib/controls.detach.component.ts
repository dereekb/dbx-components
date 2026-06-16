import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxDetachContentComponent, DbxDetachControlsComponent } from '@dereekb/dbx-web';
import { DbxStyleDemoControlsService } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoPresetsComponent } from './controls.presets.component';

/**
 * Detach panel that renders {@link DbxFormStyleDemoPresetsComponent} inside the shared detach chrome, registered as the
 * style-demo controls component via `DBX_STYLE_DEMO_CONTROLS_COMPONENT` (see `provideDbxFormStyleDemo()`).
 *
 * `DbxStyleDemoControlsService` opens this through `DbxDetachService`, so the panel survives navigation and is available
 * app-wide. It renders the presets chips (which restyle the whole app); sections (which only affect the playground page)
 * live in their own popover opened from the playground header. The component reads the same
 * {@link DbxStyleDemoControlsService} instance and forwards it to the presets component, which owns the chip field and
 * the controls↔form sync. Scrolling within the fixed-height pane comes from `.dbx-detach-content-container`.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-controls-detach',
  template: `
    <dbx-detach-content>
      <dbx-detach-controls controls header="Style Controls"></dbx-detach-controls>
      <div class="dbx-p3">
        <dbx-form-style-demo-presets [controls]="controlsService" />
      </div>
    </dbx-detach-content>
  `,
  standalone: true,
  imports: [DbxDetachContentComponent, DbxDetachControlsComponent, DbxFormStyleDemoPresetsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoControlsDetachComponent {
  readonly controlsService = inject(DbxStyleDemoControlsService);
}

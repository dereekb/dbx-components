import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractPopoverDirective, DbxPopoverCloseButtonComponent, DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective } from '@dereekb/dbx-web';
import { DbxStyleDemoControlsService } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoSectionsComponent } from './controls.sections.component';

/**
 * Popover that renders {@link DbxFormStyleDemoSectionsComponent} inside the shared popover chrome, registered as the
 * style-demo sections component via `DBX_STYLE_DEMO_SECTIONS_COMPONENT` (see `provideDbxFormStyleDemo()`).
 *
 * `DbxStyleDemoControlsService` opens this through `DbxPopoverService`, anchored to the playground header's "Sections"
 * button, because sections only affect the `<dbx-style-demo>` playground page (unlike presets, which restyle the whole
 * app). `dbx-popover-scroll-content` gives the long sections list correct scrolling. The component reads the same
 * {@link DbxStyleDemoControlsService} instance and forwards it to the sections component, which owns the chip field and
 * the controls↔form sync.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-sections-popover',
  template: `
    <dbx-popover-content>
      <dbx-popover-header icon="tune" header="Sections">
        <dbx-popover-close-button></dbx-popover-close-button>
      </dbx-popover-header>
      <dbx-popover-scroll-content>
        <div class="dbx-p2"><dbx-form-style-demo-sections [controls]="controlsService" /></div>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  standalone: true,
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentDirective, DbxFormStyleDemoSectionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoSectionsPopoverComponent extends AbstractPopoverDirective {
  readonly controlsService = inject(DbxStyleDemoControlsService);
}

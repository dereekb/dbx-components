import { ChangeDetectionStrategy, Component, type ElementRef } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AbstractPopoverDirective, type DbxPopoverComponentConfig, type DbxPopoverKey, DbxPopoverCloseButtonComponent, DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective, type DbxPopoverService } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { DBX_STYLE_DEMO_CONTROLS_POPOVER_KEY, type DbxStyleDemoControls } from './dbx.style.demo';

/**
 * Inputs for opening the {@link DbxStyleDemoControlsPopoverComponent}.
 */
export interface DbxStyleDemoControlsPopoverConfig {
  /**
   * Origin element to anchor the popover on.
   */
  readonly origin: ElementRef;
  /**
   * The playground control surface the popover reads from and writes back to.
   */
  readonly controls: DbxStyleDemoControls;
}

/**
 * Controls popover for the `<dbx-style-demo>` playground.
 *
 * Renders two grouped toggle lists — showcase sections on/off and style-lever templates — that read from and write
 * back to the host playground's signals (passed in as the popover {@link DbxStyleDemoControls} data), so flipping a
 * lever ripples token overrides through every rendered section live.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 */
@Component({
  selector: 'dbx-style-demo-controls-popover',
  template: `
    <dbx-popover-content>
      <dbx-popover-header icon="palette" header="Style Controls">
        <dbx-popover-close-button></dbx-popover-close-button>
      </dbx-popover-header>
      <dbx-popover-scroll-content>
        @if (controls; as controls) {
          <div class="dbx-flex-column dbx-p3">
            <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1">Sections</div>
            @for (section of controls.sectionsSignal(); track section.id) {
              <mat-slide-toggle class="dbx-pb1" [checked]="controls.enabledIdsSignal().has(section.id)" (change)="controls.setSectionEnabled(section.id, $event.checked)">{{ section.title }}</mat-slide-toggle>
            } @empty {
              <p class="dbx-hint">No sections registered.</p>
            }

            <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1 dbx-pt3">Style levers</div>
            @for (toggle of controls.templateTogglesSignal(); track toggle.templateName) {
              <mat-slide-toggle class="dbx-pb1" [checked]="controls.activeTemplateKeysSignal().has(toggle.templateName)" (change)="controls.setTemplateActive(toggle.templateName, $event.checked)">{{ toggle.label }}</mat-slide-toggle>
            } @empty {
              <p class="dbx-hint">No style levers registered.</p>
            }
          </div>
        }
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  standalone: true,
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentDirective, MatSlideToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxStyleDemoControlsPopoverComponent extends AbstractPopoverDirective<void, DbxStyleDemoControls> {
  get controls() {
    return this.popover.data;
  }

  static openPopover(popoverService: DbxPopoverService, { origin, controls }: DbxStyleDemoControlsPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<DbxPopoverComponentConfig<void, DbxStyleDemoControls, DbxStyleDemoControlsPopoverComponent>, void> {
    return popoverService.open({
      key: popoverKey ?? DBX_STYLE_DEMO_CONTROLS_POPOVER_KEY,
      origin,
      componentClass: DbxStyleDemoControlsPopoverComponent,
      data: controls
    });
  }
}

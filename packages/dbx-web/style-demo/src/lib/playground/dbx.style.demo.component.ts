import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, type Signal, computed, effect, inject, input, viewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import { type DbxStyleDemoSection } from '../section/section';
import { DbxStyleDemoSectionRegistry } from '../section/section.registry.service';
import { DbxStyleDemoStyleLoaderDirective } from '../style-loader/style.loader.directive';
import { DbxStyleDemoControlsService } from '../controls/controls.service';
import { type DbxStyleDemoConfig } from './dbx.style.demo';

/**
 * Drop-in styling showcase for dbx-components apps.
 *
 * Renders the registered {@link DbxStyleDemoSection} components beneath a `[dbxStyleDemoStyleLoader]` host so they
 * paint purely through the host app's `--mat-sys-*` / `--dbx-*` tokens and `.dbx-*` utilities — the playground emits
 * no theme of its own. The "Style controls" button opens the shared {@link DbxStyleDemoControlsService} detach panel
 * (also reachable from the app toolbar); flipping a lever re-points CSS tokens that ripple through every rendered
 * section live via the custom-property cascade. The button only appears when a controls component is registered.
 *
 * Section enablement and active levers are held globally in {@link DbxStyleDemoControlsService}; this playground only
 * adds its own tag filtering on top of the global enabled state.
 *
 * This component is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 *
 * @example
 * ```html
 * <dbx-style-demo [config]="{ defaultActiveTemplates: ['corner-shape-full'] }"></dbx-style-demo>
 * ```
 */
@Component({
  selector: 'dbx-style-demo',
  template: `
    <div class="dbx-style-demo dbx-flex-column dbx-p3">
      <div class="dbx-flex-bar dbx-pb3">
        <span class="dbx-text-title-large">Style Demo</span>
        <span class="dbx-flex-fill"></span>
        @if (hasSectionsSignal()) {
          <dbx-button class="dbx-button-spacer" #sectionsButton stroked icon="tune" text="Sections" (buttonClick)="openSectionsPopover()"></dbx-button>
        }
        @if (hasControlsSignal()) {
          <dbx-button stroked icon="palette" text="Style controls" (buttonClick)="openControls()"></dbx-button>
        }
      </div>
      <div [dbxStyleDemoStyleLoader]="activeTemplatesSignal()">
        <div dbxFlexGroup>
          @for (section of visibleSectionsSignal(); track section.id) {
            <div [dbxFlexSize]="3">
              <mat-card appearance="outlined" class="dbx-mb3">
                <mat-card-content class="dbx-p3">
                  <ng-container *ngComponentOutlet="section.component"></ng-container>
                </mat-card-content>
              </mat-card>
            </div>
          } @empty {
            <p class="dbx-hint">No sections enabled.</p>
          }
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [NgComponentOutlet, MatCardModule, DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxStyleDemoStyleLoaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxStyleDemoComponent {
  private readonly _registry = inject(DbxStyleDemoSectionRegistry);
  private readonly _controlsService = inject(DbxStyleDemoControlsService);

  /**
   * Playground configuration.
   */
  readonly config = input<Maybe<DbxStyleDemoConfig>>(undefined);

  /**
   * True when a controls component is registered, gating the "Style controls" button.
   */
  readonly hasControlsSignal: Signal<boolean> = this._controlsService.hasControlsSignal;

  /**
   * True when a sections component is registered, gating the "Sections" button (which opens the sections popover).
   */
  readonly hasSectionsSignal: Signal<boolean> = this._controlsService.hasSectionsSignal;

  /**
   * The "Sections" button element, used as the sections popover's anchor origin (present only while the button renders).
   */
  readonly sectionsButton = viewChild<string, Maybe<ElementRef>>('sectionsButton', { read: ElementRef });

  /**
   * The active template keys held by the controls service, applied to this playground's style-loader host.
   */
  readonly activeTemplatesSignal: Signal<string[]> = this._controlsService.activeTemplateKeysArraySignal;

  /**
   * The registry sections this playground instance considers, filtered by its configured tags (enablement stays global).
   */
  readonly sectionsSignal = computed<DbxStyleDemoSection[]>(() => {
    const tags = this.config()?.tags;
    const sections = this._registry.sectionsSignal();

    let result: DbxStyleDemoSection[];

    if (tags && tags.length > 0) {
      const tagSet = new Set(tags);
      result = sections.filter((section) => (section.tags ?? []).some((tag) => tagSet.has(tag)));
    } else {
      result = sections;
    }

    return result;
  });

  readonly visibleSectionsSignal = computed<DbxStyleDemoSection[]>(() => {
    const enabledIds = this._controlsService.enabledIdsSignal();
    return this.sectionsSignal().filter((section) => enabledIds.has(section.id));
  });

  /**
   * Seeds the controls service with this playground's configured default active templates.
   */
  protected readonly _seedDefaultTemplatesEffect = effect(() => {
    const defaults = this.config()?.defaultActiveTemplates;
    this._controlsService.setDefaultActiveTemplates(defaults ?? []);
  });

  openControls(): void {
    this._controlsService.openControls();
  }

  openSectionsPopover(): void {
    const origin = this.sectionsButton();

    if (origin != null) {
      this._controlsService.openSectionsPopover({ origin });
    }
  }
}

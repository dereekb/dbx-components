import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, type Signal, type Type, computed, inject, input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxPopupService } from '@dereekb/dbx-web';
import { type DbxStyleDemoSection, type DbxStyleDemoSectionId } from '../section/section';
import { DbxStyleDemoSectionRegistry } from '../section/section.registry.service';
import { type DbxStyleDemoStyleTemplateKey } from '../style-loader/style.template';
import { DbxStyleDemoStyleLoaderDirective } from '../style-loader/style.loader.directive';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';
import { DBX_STYLE_DEMO_TEMPLATE_TOGGLE } from '../template-toggle/template.toggle.providers';
import { DBX_STYLE_DEMO_CONTROLS_COMPONENT, DBX_STYLE_DEMO_CONTROLS_POPUP_KEY, type DbxStyleDemoConfig, type DbxStyleDemoControls } from './dbx.style.demo';

/**
 * Drop-in styling showcase for dbx-components apps.
 *
 * Renders the registered {@link DbxStyleDemoSection} components beneath a `[dbxStyleDemoStyleLoader]` host so they
 * paint purely through the host app's `--mat-sys-*` / `--dbx-*` tokens and `.dbx-*` utilities — the playground emits
 * no theme of its own. A draggable controls popup toggles sections on/off and flips style-lever templates; flipping a
 * lever re-points CSS tokens that ripple through every rendered section live via the custom-property cascade. The
 * "Style controls" button only appears when a controls component is registered via {@link DBX_STYLE_DEMO_CONTROLS_COMPONENT}.
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
export class DbxStyleDemoComponent implements DbxStyleDemoControls {
  private readonly _registry = inject(DbxStyleDemoSectionRegistry);
  private readonly _popupService = inject(DbxPopupService);
  private readonly _controlsComponentClass = inject<Type<unknown>>(DBX_STYLE_DEMO_CONTROLS_COMPONENT, { optional: true });
  private readonly _toggles = inject<DbxStyleDemoTemplateToggle[]>(DBX_STYLE_DEMO_TEMPLATE_TOGGLE, { optional: true }) ?? [];

  /**
   * Playground configuration.
   */
  readonly config = input<Maybe<DbxStyleDemoConfig>>(undefined);

  /**
   * True when a controls component is registered, gating the "Style controls" button.
   */
  readonly hasControlsSignal: Signal<boolean> = signal(this._controlsComponentClass != null);

  private readonly _sectionEnabledOverrides = signal<Map<DbxStyleDemoSectionId, boolean>>(new Map());
  private readonly _activeTemplateKeysOverride = signal<Maybe<Set<DbxStyleDemoStyleTemplateKey>>>(undefined);

  readonly templateTogglesSignal: Signal<DbxStyleDemoTemplateToggle[]> = signal(this._toggles);

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
    const overrides = this._sectionEnabledOverrides();
    return this.sectionsSignal().filter((section) => overrides.get(section.id) ?? section.defaultEnabled !== false);
  });

  readonly enabledIdsSignal = computed<Set<DbxStyleDemoSectionId>>(() => new Set(this.visibleSectionsSignal().map((section) => section.id)));

  readonly activeTemplateKeysSignal = computed<Set<DbxStyleDemoStyleTemplateKey>>(() => {
    const config = this.config();
    const override = this._activeTemplateKeysOverride();
    return override ?? new Set(config?.defaultActiveTemplates ?? []);
  });

  readonly activeTemplatesSignal = computed<DbxStyleDemoStyleTemplateKey[]>(() => [...this.activeTemplateKeysSignal()]);

  setSectionEnabled(id: DbxStyleDemoSectionId, enabled: boolean): void {
    const next = new Map(this._sectionEnabledOverrides());
    next.set(id, enabled);
    this._sectionEnabledOverrides.set(next);
  }

  setTemplateActive(key: DbxStyleDemoStyleTemplateKey, active: boolean): void {
    const next = new Set(this.activeTemplateKeysSignal());

    if (active) {
      // Levers sharing a non-null group are mutually exclusive (radio-like): deactivate the others before activating this one.
      const group = this._toggles.find((toggle) => toggle.templateName === key)?.group;

      if (group != null) {
        this._toggles.forEach((toggle) => {
          if (toggle.group === group && toggle.templateName !== key) {
            next.delete(toggle.templateName);
          }
        });
      }

      next.add(key);
    } else {
      next.delete(key);
    }

    this._activeTemplateKeysOverride.set(next);
  }

  openControls(): void {
    const componentClass = this._controlsComponentClass;

    if (componentClass != null) {
      this._popupService.open<void, DbxStyleDemoControls, unknown>({
        key: DBX_STYLE_DEMO_CONTROLS_POPUP_KEY,
        componentClass,
        data: this,
        isDraggable: true,
        position: 'bottom_right',
        width: '420px'
      });
    }
  }
}

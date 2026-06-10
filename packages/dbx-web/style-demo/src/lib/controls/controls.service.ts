import { Injectable, type Signal, type Type, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';
import { DbxDetachService, DbxStyleService, type DbxStyleSupplement } from '@dereekb/dbx-web';
import { type DbxStyleDemoSection, type DbxStyleDemoSectionId } from '../section/section';
import { DbxStyleDemoSectionRegistry } from '../section/section.registry.service';
import { type DbxStyleDemoStyleTemplateKey } from '../style-loader/style.template';
import { DbxStyleDemoStyleLoaderService } from '../style-loader/style.loader.service';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';
import { DBX_STYLE_DEMO_TEMPLATE_TOGGLE } from '../template-toggle/template.toggle.providers';
import { DBX_STYLE_DEMO_CONTROLS_COMPONENT, DBX_STYLE_DEMO_CONTROLS_DETACH_KEY, type DbxStyleDemoControls } from '../playground/dbx.style.demo';

/**
 * Configuration for the {@link DbxStyleDemoControlsService}, provided in the root environment via `provideDbxStyleDemo()`.
 */
export abstract class DbxStyleDemoControlsServiceConfig {
  /**
   * When false, the service does not forward its active style levers into the {@link DbxStyleService} as a body
   * supplement, so levers only repaint the playground subtree. Defaults to true.
   */
  abstract readonly applyStylesToApp?: Maybe<boolean>;
}

/**
 * Root-level state holder for the `<dbx-style-demo>` controls, implementing {@link DbxStyleDemoControls}.
 *
 * Owning the enabled-sections / active-template state here (rather than in the playground component) lets the controls
 * panel open through {@link DbxDetachService} so it survives navigation and is available app-wide. When a
 * {@link DbxStyleService} is available (and {@link DbxStyleDemoControlsServiceConfig.applyStylesToApp} is not false), the
 * active levers are forwarded into the style service as a body supplement so they repaint the entire app.
 *
 * This service is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 */
@Injectable()
export class DbxStyleDemoControlsService implements DbxStyleDemoControls {
  private readonly _registry = inject(DbxStyleDemoSectionRegistry);
  private readonly _toggles = inject<DbxStyleDemoTemplateToggle[]>(DBX_STYLE_DEMO_TEMPLATE_TOGGLE, { optional: true }) ?? [];
  private readonly _loaderService = inject(DbxStyleDemoStyleLoaderService);
  private readonly _detachService = inject(DbxDetachService);
  private readonly _controlsComponentClass = inject<Type<unknown>>(DBX_STYLE_DEMO_CONTROLS_COMPONENT, { optional: true });
  private readonly _styleService = inject(DbxStyleService, { optional: true });
  private readonly _config = inject(DbxStyleDemoControlsServiceConfig, { optional: true });

  private readonly _sectionEnabledOverrides = signal<Map<DbxStyleDemoSectionId, boolean>>(new Map());
  private readonly _activeTemplateKeysOverride = signal<Maybe<Set<DbxStyleDemoStyleTemplateKey>>>(undefined);
  private readonly _defaultActiveTemplateKeys = signal<DbxStyleDemoStyleTemplateKey[]>([]);

  /**
   * True when a controls component is registered, gating the controls buttons.
   */
  readonly hasControlsSignal: Signal<boolean> = signal(this._controlsComponentClass != null);

  /**
   * All registered sections, unfiltered (the global controls list every section).
   */
  readonly sectionsSignal: Signal<DbxStyleDemoSection[]> = this._registry.sectionsSignal;

  readonly templateTogglesSignal: Signal<DbxStyleDemoTemplateToggle[]> = signal(this._toggles);

  readonly enabledIdsSignal = computed<Set<DbxStyleDemoSectionId>>(() => {
    const overrides = this._sectionEnabledOverrides();
    return new Set(
      this.sectionsSignal()
        .filter((section) => overrides.get(section.id) ?? section.defaultEnabled !== false)
        .map((section) => section.id)
    );
  });

  readonly activeTemplateKeysSignal = computed<Set<DbxStyleDemoStyleTemplateKey>>(() => {
    const _defaultActiveTemplateKeys = this._defaultActiveTemplateKeys();
    const override = this._activeTemplateKeysOverride();
    return override ?? new Set(_defaultActiveTemplateKeys);
  });

  readonly activeTemplateKeysArraySignal = computed<DbxStyleDemoStyleTemplateKey[]>(() => [...this.activeTemplateKeysSignal()]);

  constructor() {
    const styleService = this._styleService;

    if (styleService != null && this._config?.applyStylesToApp !== false) {
      const supplementSignal = computed<DbxStyleSupplement>(() => {
        const { style, classes } = this._loaderService.mergeTemplates([...this.activeTemplateKeysSignal()]);
        return { style, classes };
      });

      styleService.setSupplement(toObservable(supplementSignal));
    }
  }

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

  /**
   * Seeds the default active template keys. Has no effect once the user has set an override via {@link setTemplateActive}.
   *
   * @param keys - The template keys to activate by default.
   */
  setDefaultActiveTemplates(keys: DbxStyleDemoStyleTemplateKey[]): void {
    this._defaultActiveTemplateKeys.set(keys);
  }

  /**
   * Opens the registered controls component in a draggable detached overlay. No-op when no controls component is registered.
   */
  openControls(): void {
    const componentClass = this._controlsComponentClass;

    if (componentClass != null) {
      this._detachService
        .init({
          key: DBX_STYLE_DEMO_CONTROLS_DETACH_KEY,
          componentClass,
          overlay: { width: '420px', height: '560px', isDraggable: true }
        })
        .detach();
    }
  }
}

import { ChangeDetectionStrategy, Component, type ElementRef, type Injector } from '@angular/core';
import { type NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, type DbxPopoverConfigSizing, DbxPopoverContentComponent, DbxPopoverHeaderComponent, type DbxPopoverKey, DbxPopoverScrollContentDirective, type DbxPopoverService } from '@dereekb/dbx-web';
import { DbxFirebaseModelEntitiesComponent } from './model.entities.component';
import { type Observable } from 'rxjs';
import { type LoadingState } from '@dereekb/rxjs';
import { type DbxFirebaseModelEntity } from './model.entities';
import { type Maybe } from '@dereekb/util';

export interface DbxFirebaseModelEntitiesPopoverConfig {
  /**
   * Custom icon
   *
   * Defaults to "history"
   */
  readonly icon?: string;

  /**
   * Custom header text
   *
   * Defaults to "Entities"
   */
  readonly header?: string;

  /**
   * Custom empty text when no entities exist.
   */
  readonly emptyText?: string;

  /**
   * Origin to add the popover to.
   */
  readonly origin: ElementRef;

  /**
   * Observable of entities to display.
   */
  readonly entities$: Observable<LoadingState<DbxFirebaseModelEntity[]>>;

  /**
   * Whether or not to only show entities that have a registered widget entry.
   */
  readonly onlyShowRegisteredTypes?: Maybe<boolean>;

  /**
   * Additional popover configuration.
   */
  readonly popoverSizingConfig?: Maybe<DbxPopoverConfigSizing>;

  /**
   * Injector to use for the popover.
   */
  readonly injector?: Maybe<Injector>;
}

export type DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin = Omit<DbxFirebaseModelEntitiesPopoverConfig, 'origin' | 'entities$'>;

export const DEFAULT_DBX_FIREBASE_MODEL_ENTITIES_COMPONENT_POPOVER_KEY = 'entities';

@Component({
  templateUrl: './model.entities.popover.component.html',
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective, DbxFirebaseModelEntitiesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesPopoverComponent extends AbstractPopoverDirective<unknown, DbxFirebaseModelEntitiesPopoverConfig> {
  readonly entities$ = this.popover.data?.entities$;

  static openPopover(popupService: DbxPopoverService, config: DbxFirebaseModelEntitiesPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef {
    const { origin, header, icon, emptyText, entities$, onlyShowRegisteredTypes, popoverSizingConfig, injector } = config;

    return popupService.open({
      height: '600px',
      width: '800px',
      injector: injector ?? undefined,
      isResizable: true,
      ...popoverSizingConfig,
      key: popoverKey ?? DEFAULT_DBX_FIREBASE_MODEL_ENTITIES_COMPONENT_POPOVER_KEY,
      origin,
      componentClass: DbxFirebaseModelEntitiesPopoverComponent,
      data: {
        header,
        icon,
        emptyText,
        entities$,
        onlyShowRegisteredTypes
      }
    });
  }

  get config(): DbxFirebaseModelEntitiesPopoverConfig {
    return this.popover.data as DbxFirebaseModelEntitiesPopoverConfig;
  }

  readonly icon = this.config.icon ?? 'data_object';
  readonly header = this.config.header ?? 'Entities';
  readonly emptyText = this.config.emptyText ?? 'No entities found in current context.';
  readonly onlyShowRegisteredTypes = this.config.onlyShowRegisteredTypes;
}

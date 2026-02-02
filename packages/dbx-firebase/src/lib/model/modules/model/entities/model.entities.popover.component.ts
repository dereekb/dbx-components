import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, DbxListEmptyContentComponent, DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverKey, DbxPopoverScrollContentDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { DbxFirebaseModelEntitiesComponent } from './model.entities.component';
import { Observable } from 'rxjs';
import { LoadingState } from '@dereekb/rxjs';
import { DbxFirebaseModelEntity } from './model.entities';

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
}

export type DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin = Omit<DbxFirebaseModelEntitiesPopoverConfig, 'origin' | 'entities$'>;

export const DEFAULT_DBX_FIREBASE_MODEL_ENTITIES_COMPONENT_POPOVER_KEY = 'entities';

@Component({
  templateUrl: './model.entities.popover.component.html',
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective, DbxFirebaseModelEntitiesComponent, DbxListEmptyContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesPopoverComponent extends AbstractPopoverDirective<unknown, DbxFirebaseModelEntitiesPopoverConfig> {
  readonly entities$ = this.popover.data?.entities$;

  static openPopover(popupService: DbxPopoverService, { origin, header, icon, emptyText, entities$ }: DbxFirebaseModelEntitiesPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_DBX_FIREBASE_MODEL_ENTITIES_COMPONENT_POPOVER_KEY,
      origin,
      componentClass: DbxFirebaseModelEntitiesPopoverComponent,
      data: {
        header,
        icon,
        emptyText,
        entities$
      },
      isResizable: true
    });
  }

  get config(): DbxFirebaseModelEntitiesPopoverConfig {
    return this.popover.data as DbxFirebaseModelEntitiesPopoverConfig;
  }

  readonly icon = this.config.icon ?? 'data_object';
  readonly header = this.config.header ?? 'Entities';
  readonly emptyText = this.config.emptyText ?? 'No entities found in current context.';
}

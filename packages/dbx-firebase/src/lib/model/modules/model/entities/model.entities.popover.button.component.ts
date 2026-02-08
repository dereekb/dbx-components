import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxButtonComponent, DbxButtonStyle, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseModelEntitiesPopoverComponent, DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin } from './model.entities.popover.component';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseModelEntitiesSource } from './model.entities';
import { DbxButtonDisplay } from '@dereekb/dbx-core';

export interface DbxFirebaseModelEntitiesPopoverButtonConfig extends DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin {
  /**
   * The display configuration for the button.
   */
  readonly buttonDisplay?: Maybe<DbxButtonDisplay>;
  /**
   * The style configuration for the button.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
}

@Component({
  selector: 'dbx-firebase-model-entities-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showEntitiesPopover()" [buttonStyle]="buttonStyleSignal()" [buttonDisplay]="buttonDisplaySignal()"></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseModelEntitiesPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);

  readonly entitiesSource = inject(DbxFirebaseModelEntitiesSource);

  readonly buttonElement = viewChild.required<string, ElementRef>('button', { read: ElementRef });
  readonly config = input<DbxFirebaseModelEntitiesPopoverButtonConfig>();

  readonly buttonDisplaySignal = computed(() => {
    const config = this.config();
    return config?.buttonDisplay ?? { icon: config?.icon ?? 'data_object' };
  });

  readonly buttonStyleSignal = computed(() => this.config()?.buttonStyle);

  protected override _makePopoverRef(origin?: Maybe<ElementRef>): NgPopoverRef<unknown, unknown> {
    if (!origin) {
      throw new Error('Missing origin.');
    }

    const config = this.config();
    const entities$ = this.entitiesSource.entities$;

    return DbxFirebaseModelEntitiesPopoverComponent.openPopover(this._dbxPopoverService, {
      origin,
      ...config,
      entities$
    });
  }

  showEntitiesPopover(): void {
    const origin = this.buttonElement();
    this.showPopover(origin);
  }
}

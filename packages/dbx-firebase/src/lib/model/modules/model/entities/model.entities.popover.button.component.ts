import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxIconButtonComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseModelEntitiesPopoverComponent, DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin } from './model.entities.popover.component';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseModelEntitiesSource } from './model.entities';

export type DbxFirebaseModelEntitiesPopoverButtonConfig = DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin;

@Component({
  selector: 'dbx-firebase-model-entities-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showEntitiesPopover()" icon="data_object"></dbx-icon-button>
  `,
  standalone: true,
  imports: [DbxIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseModelEntitiesPopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);
  readonly entitiesSource = inject(DbxFirebaseModelEntitiesSource);

  readonly buttonElement = viewChild.required<string, ElementRef>('button', { read: ElementRef });
  readonly config = input<DbxFirebaseModelEntitiesPopoverConfigWithoutOrigin>();

  protected override _makePopoverRef(origin?: Maybe<ElementRef>): NgPopoverRef<unknown, unknown> {
    const config = this.config();
    const entities$ = this.entitiesSource.entities$;

    if (!origin) {
      throw new Error('Missing origin.');
    }

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

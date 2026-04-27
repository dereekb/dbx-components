import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AbstractDbxButtonDirective, provideDbxButton } from '@dereekb/dbx-core';

/**
 * Lightweight button that renders as either an icon-only Material icon button or a text button
 * with an icon prefix, depending on whether text is provided.
 *
 * @dbxWebComponent
 * @dbxWebSlug icon-button
 * @dbxWebCategory button
 * @dbxWebRelated button
 * @dbxWebSkillRefs dbx__migration__migrate-dbx-icon-button
 * @dbxWebMinimalExample ```html
 * <dbx-icon-button icon="add"></dbx-icon-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-icon-button icon="delete" color="warn" [dbxAction]="deleteAction"></dbx-icon-button>
 * ```
 */
@Component({
  selector: 'dbx-icon-button',
  template: `
    @switch (buttonDisplayTypeSignal()) {
      @case ('text_button') {
        <button mat-button class="mat-unthemed" [disabled]="disabledSignal()" [attr.aria-label]="ariaLabel()" (click)="clickButton()">
          @if (iconSignal()) {
            <mat-icon class="dbx-icon-spacer">{{ iconSignal() }}</mat-icon>
          }
          <span>{{ textSignal() }}</span>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
      @case ('icon_button') {
        <button mat-icon-button [disabled]="disabledSignal()" [attr.aria-label]="ariaLabel() || iconSignal()" (click)="clickButton()">
          <mat-icon aria-hidden="true">{{ iconSignal() }}</mat-icon>
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      }
    }
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- self-reference in the deprecated component
  providers: provideDbxButton(DbxIconButtonComponent),
  host: {
    class: 'dbx-icon-button'
  },
  imports: [MatButtonModule, MatIconModule, MatIconButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxIconButtonComponent extends AbstractDbxButtonDirective {}

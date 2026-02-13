import { skipAllInitialMaybe } from '@dereekb/rxjs';
import { Component, TemplateRef, HostListener, inject, viewChild, input, ChangeDetectionStrategy, computed, ElementRef } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponentConfig, DbxInjectionComponent } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { NgTemplateOutlet, NgClass } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';
import { overrideClickElementEffect } from '../../../util/click';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  template: `
    @switch (typeSignal()) {
      @case ('plain') {
        <ng-container *ngTemplateOutlet="content"></ng-container>
      }
      @case ('clickable') {
        <a #clickable class="dbx-anchor-a dbx-anchor-click" [ngClass]="selectedClassSignal()" (click)="clickAnchor()">
          <span #childClickTarget>
            <ng-container *ngTemplateOutlet="content"></ng-container>
          </span>
        </a>
      }
      @case ('sref') {
        <dbx-injection [config]="srefAnchorConfig">
          <!-- Injected in child. -->
        </dbx-injection>
      }
      @case ('href') {
        <a class="dbx-anchor-a dbx-anchor-href" [href]="urlSignal()" [attr.target]="targetSignal()">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </a>
      }
      @case ('disabled') {
        <a class="dbx-anchor-a dbx-anchor-disabled">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </a>
      }
    }
    <!-- Template content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  standalone: true,
  imports: [NgTemplateOutlet, NgClass, DbxInjectionComponent],
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective {
  private readonly _dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  readonly block = input<Maybe<boolean>>();

  readonly clickableElement = viewChild<string, Maybe<ElementRef<HTMLElement>>>('clickable', { read: ElementRef });
  readonly childClickTarget = viewChild<string, Maybe<ElementRef<HTMLElement>>>('childClickTarget', { read: ElementRef });

  readonly templateRef = viewChild<string, Maybe<TemplateRef<unknown>>>('content', { read: TemplateRef });
  readonly templateRef$ = toObservable(this.templateRef).pipe(skipAllInitialMaybe(), shareReplay(1));

  readonly selectedClassSignal = computed(() => (this.selectedSignal() ? 'dbx-anchor-selected' : ''));

  readonly srefAnchorConfig: DbxInjectionComponentConfig = this._dbNgxRouterWebProviderConfig.anchorSegueRefComponent;

  protected readonly _overrideClickElementEffect = overrideClickElementEffect({
    clickTarget: this.clickableElement,
    childClickTarget: this.childClickTarget,
    disabledSignal: computed(() => this.typeSignal() !== 'clickable')
  });

  clickAnchor(event?: Maybe<MouseEvent>): void {
    console.log('click anchor');
    this.anchor()?.onClick?.(event);
  }

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor()?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor()?.onMouse?.('leave', event);
  }
}

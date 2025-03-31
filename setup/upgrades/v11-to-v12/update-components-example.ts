// This file is an example of how to upgrade a component from Angular 16 to Angular 18. It has a BEFORE and AFTER section that are valid typescript.
/*
========= BEFORE =========
- Angular 16
*/
import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild, OnDestroy, HostListener, inject } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { map, distinctUntilChanged, shareReplay, BehaviorSubject } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';

@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  template: `
    <ng-container [ngSwitch]="type$ | async">
      <!-- Plain -->
      <ng-container *ngSwitchCase="0">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </ng-container>
      <!-- Click -->
      <a class="dbx-anchor-a dbx-anchor-click" [ngClass]="(selectedClass$ | async) || ''" (click)="clickAnchor()" *ngSwitchCase="1">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
      <!-- Router -->
      <dbx-injection [config]="srefAnchorConfig" *ngSwitchCase="2">
        <!-- Injected in child. -->
      </dbx-injection>
      <!-- Href -->
      <a class="dbx-anchor-a dbx-anchor-href" [href]="url$ | async" [attr.target]="target$ | async" *ngSwitchCase="3">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
      <!-- Disabled or None -->
      <a class="dbx-anchor-a dbx-anchor-disabled" *ngSwitchDefault>
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    </ng-container>
    <ng-container *ngIf="block">
      <p>block example</p>
    </ng-container>
    <!-- Template content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block'
  }
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective implements OnDestroy {
  private readonly dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  private readonly _templateRef = new BehaviorSubject<Maybe<TemplateRef<unknown>>>(undefined);
  readonly templateRef$ = this._templateRef.pipe(skipFirstMaybe(), shareReplay(1));

  @Input()
  public block?: boolean;

  @ViewChild('content', { read: TemplateRef })
  get templateRef(): Maybe<TemplateRef<unknown>> {
    return this._templateRef.value;
  }

  set templateRef(templateRef: Maybe<TemplateRef<unknown>>) {
    this._templateRef.next(templateRef);
  }

  readonly url$ = this.anchor$.pipe(
    map((x) => x?.url),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly target$ = this.anchor$.pipe(
    map((x) => x?.target),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly selectedClass$ = this.selected$.pipe(
    map((selected) => (selected ? 'dbx-anchor-selected' : '')),
    shareReplay(1)
  );

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._templateRef.complete();
  }

  get srefAnchorConfig(): DbxInjectionComponentConfig {
    return this.dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('leave', event);
  }
}
/*
========= AFTER =========
- Angular 18
- Uses Angular signals in the template. Values are read by referencing and executing the signal variable. (e.g. {{ block() instead of block }})
- Uses new @switch syntax instead of ngSwitch and @case instead of ngSwitchCase
- Uses input() signal that replaces @Input() and getter/setter usage
- Uses viewChild() signal instead of @ViewChild getter/setter
*/
import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild, OnDestroy, HostListener, inject, computed, ChangeDetectionStrategy, viewChild, input } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponent, DbxInjectionComponentConfig, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { map, distinctUntilChanged, shareReplay, BehaviorSubject } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';
import { NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  template: `
    @switch (typeSignal()) {
      @case (0) {
        <ng-container *ngTemplateOutlet="content"></ng-container>
      }
      @case (1) {
        <a class="dbx-anchor-a dbx-anchor-click" [ngClass]="selectedClassSignal()" (click)="clickAnchor()">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </a>
      }
      @case (2) {
        <dbx-injection [config]="srefAnchorConfig">
          <!-- Injected in child. -->
        </dbx-injection>
      }
      @case (3) {
        <a class="dbx-anchor-a dbx-anchor-href" [href]="urlSignal()" [attr.target]="targetSignal()">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </a>
      }
      @case (4) {
        <a class="dbx-anchor-a dbx-anchor-disabled">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </a>
      }
    }
    @if (block()) {
      <p>block example</p>
    }
    <!-- Template content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  standalone: true,
  imports: [NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet, AsyncPipe, DbxInjectionComponent],
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective implements OnDestroy {

  private readonly _dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  readonly block = input<Maybe<boolean>>();

  readonly templateRef = viewChild<TemplateRef<unknown>>('content');

  readonly templateRef$ = toObservable(this.templateRef).pipe(skipFirstMaybe(), shareReplay(1));
  readonly selectedClassSignal = computed(() => (this.selectedSignal() ? 'dbx-anchor-selected' : ''));

  get srefAnchorConfig(): DbxInjectionComponentConfig {
    return this._dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('leave', event);
  }
}
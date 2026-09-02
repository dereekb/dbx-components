import { type DbxActionContextStoreSourceInstance, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild, signal } from '@angular/core';
import { DbxActionConfirmDirective, type DbxActionConfirmConfig } from './action.confirm.directive';
import { DbxButtonComponent } from '../button/button.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { type WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay, EMPTY } from 'rxjs';
import { DbxRouterTransitionService } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

const AUTO_CONFIRM_READY_VALUE = 'autoConfirmReadyValue';

// MARK: Test Components
@Component({
  template: `
    <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleAction" [dbxActionConfirm]="confirmConfig">
      <dbx-button dbxActionButton text="Confirm Action"></dbx-button>
    </ng-container>
  `,
  imports: [DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionConfirmDirective, DbxButtonComponent, DbxActionButtonDirective]
})
class TestConfirmComponent {
  readonly dbxActionDirective = viewChild.required(DbxActionDirective);

  confirmConfig: DbxActionConfirmConfig = {
    title: 'Confirm Test',
    prompt: 'Are you sure?'
  };

  readonly handleAction: WorkUsingObservable = () => of(true).pipe(delay(100));
}

@Component({
  template: `
    <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleAction" [dbxActionConfirm]="confirmConfig" [dbxActionConfirmSkip]="skipConfirm()">
      <dbx-button dbxActionButton text="Skip Confirm Action"></dbx-button>
    </ng-container>
  `,
  imports: [DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionConfirmDirective, DbxButtonComponent, DbxActionButtonDirective]
})
class TestConfirmSkipComponent {
  readonly dbxActionDirective = viewChild.required(DbxActionDirective);

  readonly skipConfirm = signal(false);

  confirmConfig: DbxActionConfirmConfig = {
    title: 'Confirm Test',
    prompt: 'Are you sure?'
  };

  readonly handleAction: WorkUsingObservable = () => of(true).pipe(delay(100));
}

@Component({
  template: `
    <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleAction" [dbxActionConfirm]="confirmConfig()">
      <dbx-button dbxActionButton text="Auto Confirm Action"></dbx-button>
    </ng-container>
  `,
  imports: [DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionConfirmDirective, DbxButtonComponent, DbxActionButtonDirective]
})
class TestAutoConfirmComponent {
  readonly dbxActionDirective = viewChild.required(DbxActionDirective);

  readonly confirmConfig = signal<Maybe<DbxActionConfirmConfig>>({
    autoConfirm: true,
    readyValue: AUTO_CONFIRM_READY_VALUE
  });

  readonly handleAction: WorkUsingObservable = () => of(true).pipe(delay(100));
}

// MARK: Tests
describe('DbxActionConfirmDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule],

      providers: [{ provide: DbxRouterTransitionService, useValue: { transitions$: EMPTY } }]
    });
  });

  describe('with confirm config', () => {
    let fixture: ComponentFixture<TestConfirmComponent>;
    let component: TestConfirmComponent;
    let sourceInstance: DbxActionContextStoreSourceInstance;
    let matDialog: MatDialog;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestConfirmComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      sourceInstance = component.dbxActionDirective().sourceInstance;
      matDialog = TestBed.inject(MatDialog);
    });

    afterEach(() => {
      matDialog.closeAll();
      fixture.destroy();
    });

    it('should open a confirmation dialog when triggered', async () => {
      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(1);

      matDialog.closeAll();
    });
  });

  describe('with dbxActionConfirmSkip', () => {
    let fixture: ComponentFixture<TestConfirmSkipComponent>;
    let component: TestConfirmSkipComponent;
    let sourceInstance: DbxActionContextStoreSourceInstance;
    let matDialog: MatDialog;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestConfirmSkipComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      sourceInstance = component.dbxActionDirective().sourceInstance;
      matDialog = TestBed.inject(MatDialog);
    });

    afterEach(() => {
      matDialog.closeAll();
      fixture.destroy();
    });

    it('should open dialog when skip is false', async () => {
      component.skipConfirm.set(false);
      fixture.detectChanges();

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(1);

      matDialog.closeAll();
    });

    it('should not open dialog when skip is true', async () => {
      component.skipConfirm.set(true);
      fixture.detectChanges();

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(0);
    });

    it('should pass through readyValue when skip is true', async () => {
      component.skipConfirm.set(true);
      fixture.detectChanges();

      let wasReady = false;

      sourceInstance.valueReady$.subscribe(() => {
        wasReady = true;
      });

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(wasReady).toBe(true);
    });
  });

  describe('with autoConfirm config', () => {
    let fixture: ComponentFixture<TestAutoConfirmComponent>;
    let component: TestAutoConfirmComponent;
    let sourceInstance: DbxActionContextStoreSourceInstance;
    let matDialog: MatDialog;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestAutoConfirmComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      sourceInstance = component.dbxActionDirective().sourceInstance;
      matDialog = TestBed.inject(MatDialog);
    });

    afterEach(() => {
      matDialog.closeAll();
      fixture.destroy();
    });

    it('should not open a dialog and should pass through the readyValue', async () => {
      let readyValue: unknown;

      sourceInstance.valueReady$.subscribe((value) => {
        readyValue = value;
      });

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(0);
      expect(readyValue).toBe(AUTO_CONFIRM_READY_VALUE);
    });

    it('should open a dialog when autoConfirm is false', async () => {
      component.confirmConfig.set({ autoConfirm: false, title: 'Confirm Test' });
      fixture.detectChanges();

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(1);

      matDialog.closeAll();
    });

    it('should open a dialog when the config is undefined', async () => {
      component.confirmConfig.set(undefined);
      fixture.detectChanges();

      sourceInstance.trigger();
      await fixture.whenStable();

      expect(matDialog.openDialogs.length).toBe(1);

      matDialog.closeAll();
    });
  });
});

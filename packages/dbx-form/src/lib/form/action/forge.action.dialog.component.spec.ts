import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, NEVER, first, firstValueFrom, timeout } from 'rxjs';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { DbxRouterTransitionService } from '@dereekb/dbx-core';
import { provideDbxForgeFormFieldDeclarations } from '../../forge/forge.providers';
import { provideDbxFormConfiguration } from '../../form.providers';
import { dbxForgeTextField } from '../../forge/field/value/text/text.field';
import { DbxForgeActionDialogComponent, type DbxForgeActionDialogComponentConfig } from './forge.action.dialog.component';

// MARK: Mock
class MockDbxRouterTransitionService extends DbxRouterTransitionService {
  readonly transitions$ = NEVER;
}

// MARK: Helpers
function createSimpleConfig(): FormConfig {
  return {
    fields: [dbxForgeTextField({ key: 'name', label: 'Name', required: true }) as any]
  };
}

function createDialogConfig<O = { name: string }>(overrides?: Partial<DbxForgeActionDialogComponentConfig<O>>): DbxForgeActionDialogComponentConfig<O> {
  return {
    header: 'Test Dialog',
    config: of(createSimpleConfig()),
    ...overrides
  } as DbxForgeActionDialogComponentConfig<O>;
}

const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideNoopAnimations(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }, { provide: DbxRouterTransitionService, useClass: MockDbxRouterTransitionService }];

// MARK: Test Host
@Component({
  template: `
    <div></div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class DialogTestHostComponent {
  readonly matDialog = inject(MatDialog);
}

// MARK: Tests
describe('DbxForgeActionDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DialogTestHostComponent, MatDialogModule],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('openDialogWithForm()', () => {
    it('should open a dialog and return a dialog ref', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;
      const config = createDialogConfig();

      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);
      expect(dialogRef).toBeDefined();
      expect(dialogRef.componentInstance).toBeInstanceOf(DbxForgeActionDialogComponent);

      dialogRef.close();
      fixture.destroy();
    });

    it('should use default dialog dimensions', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;
      const openSpy = vi.spyOn(matDialog, 'open');

      const config = createDialogConfig();
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(openSpy).toHaveBeenCalledWith(
        DbxForgeActionDialogComponent,
        expect.objectContaining({
          width: '90vw',
          maxHeight: '300px',
          maxWidth: '600px'
        })
      );

      dialogRef.close();
      fixture.destroy();
    });

    it('should merge custom dialog config overriding defaults', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;
      const openSpy = vi.spyOn(matDialog, 'open');

      const config = createDialogConfig({
        dialog: { width: '50vw', maxWidth: '400px', panelClass: 'custom-panel' }
      });
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(openSpy).toHaveBeenCalledWith(
        DbxForgeActionDialogComponent,
        expect.objectContaining({
          width: '50vw',
          maxWidth: '400px',
          panelClass: 'custom-panel'
        })
      );

      dialogRef.close();
      fixture.destroy();
    });

    it('should set header from config', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const config = createDialogConfig({ header: 'Custom Header' });
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(dialogRef.componentInstance.header).toBe('Custom Header');

      dialogRef.close();
      fixture.destroy();
    });

    it('should default submit button text to Submit', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const config = createDialogConfig();
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(dialogRef.componentInstance.submitButtonConfig.text).toBe('Submit');

      dialogRef.close();
      fixture.destroy();
    });

    it('should use custom submit button config', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const config = createDialogConfig({
        submitButtonConfig: { text: 'Save', icon: 'save' }
      });
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(dialogRef.componentInstance.submitButtonConfig.text).toBe('Save');
      expect(dialogRef.componentInstance.submitButtonConfig.icon).toBe('save');

      dialogRef.close();
      fixture.destroy();
    });

    it('should close with undefined when dismissed without submit', async () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const config = createDialogConfig();
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      const resultPromise = firstValueFrom(dialogRef.afterClosed().pipe(timeout(2000), first()));

      dialogRef.close();

      const result = await resultPromise;
      expect(result).toBeUndefined();

      fixture.destroy();
    });

    it('should close with value when handleSubmitValue is invoked', async () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const config = createDialogConfig();
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      const resultPromise = firstValueFrom(dialogRef.afterClosed().pipe(timeout(2000), first()));

      const component = dialogRef.componentInstance;
      const mockContext = { success: vi.fn() };
      component.handleSubmitValue({ name: 'Submitted' } as any, mockContext as any);

      const result = await resultPromise;
      expect(result).toEqual({ name: 'Submitted' });
      expect(mockContext.success).toHaveBeenCalled();

      fixture.destroy();
    });

    it('should provide initialValue$ from config', () => {
      const fixture = TestBed.createComponent(DialogTestHostComponent);
      const matDialog = fixture.componentInstance.matDialog;

      const initialValue$ = of({ name: 'Prefilled' });
      const config = createDialogConfig({ initialValue: initialValue$ });
      const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(matDialog, config);

      expect(dialogRef.componentInstance.initialValue$).toBeDefined();

      dialogRef.close();
      fixture.destroy();
    });
  });
});

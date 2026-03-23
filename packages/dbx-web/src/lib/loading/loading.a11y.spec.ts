import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { type Maybe } from '@dereekb/util';
import { expectNoA11yViolations } from '../../../../../vitest.a11y';

describe('Loading a11y', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  describe('DbxBasicLoadingComponent', () => {
    let fixture: ComponentFixture<TestBasicLoadingComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestBasicLoadingComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should have role="status" and aria-live="polite" when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      const statusEl = fixture.debugElement.query(By.css('[role="status"]'));
      expect(statusEl).not.toBeNull();
      expect(statusEl.attributes['aria-live']).toBe('polite');
      expect(statusEl.attributes['aria-busy']).toBe('true');
    });

    it('should have role="alert" and aria-live="assertive" when in error state', () => {
      fixture.componentRef.setInput('error', { code: 'TEST', message: 'Test error' });
      fixture.detectChanges();

      const alertEl = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(alertEl).not.toBeNull();
      expect(alertEl.attributes['aria-live']).toBe('assertive');
    });

    it('should not have role wrappers when showing content', () => {
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const statusEl = fixture.debugElement.query(By.css('[role="status"]'));
      const alertEl = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(statusEl).toBeNull();
      expect(alertEl).toBeNull();
    });
  });

  describe('DbxLoadingProgressComponent', () => {
    let fixture: ComponentFixture<DbxLoadingProgressComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(DbxLoadingProgressComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should have role="status" on the progress view', () => {
      fixture.detectChanges();

      const statusEl = fixture.debugElement.query(By.css('[role="status"]'));
      expect(statusEl).not.toBeNull();
    });

    it('should have default aria-label="Loading"', () => {
      fixture.detectChanges();

      const statusEl = fixture.debugElement.query(By.css('[role="status"]'));
      expect(statusEl.attributes['aria-label']).toBe('Loading');
    });

    it('should use text input as aria-label when provided', () => {
      fixture.componentRef.setInput('text', 'Uploading files...');
      fixture.detectChanges();

      const statusEl = fixture.debugElement.query(By.css('[role="status"]'));
      expect(statusEl.attributes['aria-label']).toBe('Uploading files...');
    });
  });
});

@Component({
  selector: 'dbx-test-basic-loading',
  template: `
    <dbx-basic-loading [loading]="loading()" [error]="error()"><p>Content</p></dbx-basic-loading>
  `,
  standalone: true,
  imports: [DbxBasicLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestBasicLoadingComponent {
  readonly loading = input<Maybe<boolean>>();
  readonly error = input<Maybe<{ code: string; message: string }>>();
}

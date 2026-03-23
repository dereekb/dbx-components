import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DbxErrorViewComponent } from './error.view.component';

describe('Error a11y', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  describe('DbxErrorViewComponent', () => {
    let fixture: ComponentFixture<DbxErrorViewComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(DbxErrorViewComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should have aria-label on the error icon button', () => {
      fixture.componentRef.setInput('message', 'Something went wrong');
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBe('View error details');
    });

    it('should have role="alert" on the error message', () => {
      fixture.componentRef.setInput('message', 'Something went wrong');
      fixture.detectChanges();

      const messageEl = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(messageEl).not.toBeNull();
      expect(messageEl.nativeElement.textContent).toContain('Something went wrong');
    });

    it('should have aria-hidden on the decorative icon', () => {
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.attributes['aria-hidden']).toBe('true');
    });

    it('should have fallback aria-label when no message is provided', () => {
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBe('Error');
    });
  });
});

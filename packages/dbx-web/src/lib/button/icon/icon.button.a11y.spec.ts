/* eslint-disable @typescript-eslint/no-deprecated -- testing the deprecated component itself */
import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DbxIconButtonComponent } from './icon.button.component';

describe('DbxIconButtonComponent a11y', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  let fixture: ComponentFixture<DbxIconButtonComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DbxIconButtonComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('icon-only button', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('icon', 'settings');
      fixture.detectChanges();
    });

    it('should fall back to icon name as aria-label when no ariaLabel is provided', () => {
      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBe('settings');
    });

    it('should use explicit ariaLabel when provided', () => {
      fixture.componentRef.setInput('ariaLabel', 'Open settings');
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBe('Open settings');
    });

    it('should have aria-hidden on the decorative mat-icon', () => {
      const icon = fixture.debugElement.query(By.css('mat-icon'));
      expect(icon.attributes['aria-hidden']).toBe('true');
    });
  });

  describe('text button', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('icon', 'save');
      fixture.componentRef.setInput('text', 'Save');
      fixture.detectChanges();
    });

    it('should not set aria-label when text is visible', () => {
      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBeFalsy();
    });

    it('should set aria-label when explicitly provided on text button', () => {
      fixture.componentRef.setInput('ariaLabel', 'Save changes');
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      expect(button.attributes['aria-label']).toBe('Save changes');
    });
  });
});

import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DbxButtonComponent } from './button.component';

describe('DbxButtonComponent fab', () => {
  let fixture: ComponentFixture<DbxButtonComponent>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(DbxButtonComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('icon without text', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('fab', true);
      fixture.componentRef.setInput('icon', 'add');
      fixture.detectChanges();
    });

    it('should render a Material FAB', () => {
      expect(button().classList).toContain('mat-mdc-fab');
      expect(button().classList).not.toContain('mat-mdc-extended-fab');
      expect(button().classList).not.toContain('mat-mdc-icon-button');
    });

    it('should show the icon and no text', () => {
      expect(button().querySelector('mat-icon.mat-fab-icon')).not.toBeNull();
      expect(button().querySelector('.button-text')).toBeNull();
    });

    it('should show the spinner and hide the icon while working', () => {
      fixture.componentRef.setInput('working', true);
      fixture.detectChanges();

      expect(button().querySelector('.mat-mdc-progress-spinner')).not.toBeNull();
      expect(button().querySelector('mat-icon.mat-fab-icon')?.classList).toContain('working');
    });
  });

  describe('icon with text', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('fab', true);
      fixture.componentRef.setInput('icon', 'save');
      fixture.componentRef.setInput('text', 'Save');
      fixture.detectChanges();
    });

    it('should render an extended Material FAB', () => {
      expect(button().classList).toContain('mat-mdc-fab');
      expect(button().classList).toContain('mat-mdc-extended-fab');
    });

    it('should show the icon and text', () => {
      expect(button().querySelector('mat-icon.mat-button-icon')).not.toBeNull();
      expect(button().querySelector('.button-text')?.textContent).toContain('Save');
    });

    it('should not apply the mat-button variant classes', () => {
      fixture.componentRef.setInput('raised', true);
      fixture.detectChanges();

      expect(button().classList).not.toContain('mat-mdc-raised-button');
    });

    it('should show the spinner and hide the content while working', () => {
      fixture.componentRef.setInput('working', true);
      fixture.detectChanges();

      expect(button().querySelector('.mat-mdc-progress-spinner')).not.toBeNull();
      expect(button().querySelector('.button-text')?.classList).toContain('working');
      expect(button().querySelector('mat-icon.mat-button-icon')?.classList).toContain('working');
    });
  });

  describe('with iconOnly', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('fab', true);
      fixture.componentRef.setInput('iconOnly', true);
      fixture.componentRef.setInput('icon', 'settings');
      fixture.detectChanges();
    });

    it('should keep the round icon button presentation', () => {
      expect(button().classList).toContain('mat-mdc-icon-button');
      expect(button().classList).toContain('dbx-progress-spinner-fab');
      expect(button().classList).not.toContain('mat-mdc-fab');
    });
  });

  describe('without fab', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('icon', 'add');
      fixture.detectChanges();
    });

    it('should fall back to an icon button for an icon without text', () => {
      expect(button().classList).toContain('mat-mdc-icon-button');
      expect(button().classList).not.toContain('mat-mdc-fab');
    });
  });
});

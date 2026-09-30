import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type Maybe } from '@dereekb/util';
import { type DbxButtonFloatingConfig, DbxButtonFloatingDirective, type DbxButtonFloatingMode, type DbxButtonFloatingOffset, type DbxButtonFloatingPosition } from './button.floating.directive';

@Component({
  template: `
    <div id="host" [dbxButtonFloating]="config()" [dbxButtonFloatingMode]="mode()" [dbxButtonFloatingPosition]="position()" [dbxButtonFloatingOffset]="offset()"></div>
    <div id="bare" dbxButtonFloating></div>
    <div id="shorthand" dbxButtonFloating="top-center"></div>
  `,
  imports: [DbxButtonFloatingDirective]
})
class TestHostComponent {
  readonly config = signal<Maybe<DbxButtonFloatingConfig | DbxButtonFloatingPosition>>(undefined);
  readonly mode = signal<Maybe<DbxButtonFloatingMode>>(undefined);
  readonly position = signal<Maybe<DbxButtonFloatingPosition>>(undefined);
  readonly offset = signal<Maybe<DbxButtonFloatingOffset>>(undefined);
}

describe('DbxButtonFloatingDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  function element(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  }

  function hostClasses(id = 'host'): string[] {
    return Array.from(element(id).classList).filter((x) => x.startsWith('dbx-button-floating'));
  }

  function hostOffset(axis: 'x' | 'y'): string {
    return element('host').style.getPropertyValue(`--dbx-button-floating-offset-${axis}`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('classes', () => {
    it('should default to a sticky bottom-right float when used as a bare attribute', () => {
      expect(hostClasses('bare')).toEqual(['dbx-button-floating']);
    });

    it('should treat a string value as the position shorthand', () => {
      expect(hostClasses('shorthand')).toEqual(expect.arrayContaining(['dbx-button-floating', 'dbx-button-floating-top', 'dbx-button-floating-center']));
      expect(hostClasses('shorthand')).not.toContain('dbx-button-floating-fixed');
    });

    it('should add the fixed class in fixed mode', () => {
      component.mode.set('fixed');
      fixture.detectChanges();
      expect(hostClasses()).toEqual(expect.arrayContaining(['dbx-button-floating', 'dbx-button-floating-fixed']));
    });

    it('should add the top and left classes for a top-left position', () => {
      component.position.set('top-left');
      fixture.detectChanges();
      expect(hostClasses()).toEqual(expect.arrayContaining(['dbx-button-floating-top', 'dbx-button-floating-left']));
      expect(hostClasses()).not.toContain('dbx-button-floating-center');
    });

    it('should add the center class for a bottom-center position', () => {
      component.position.set('bottom-center');
      fixture.detectChanges();
      expect(hostClasses()).toContain('dbx-button-floating-center');
      expect(hostClasses()).not.toContain('dbx-button-floating-top');
    });

    it('should read the mode and position from the config', () => {
      component.config.set({ mode: 'fixed', position: 'top-right' });
      fixture.detectChanges();
      expect(hostClasses()).toEqual(expect.arrayContaining(['dbx-button-floating-fixed', 'dbx-button-floating-top']));
      expect(hostClasses()).not.toContain('dbx-button-floating-left');
    });

    it('should prefer the individual inputs over the config', () => {
      component.config.set({ mode: 'fixed', position: 'top-right' });
      component.mode.set('sticky');
      component.position.set('bottom-left');
      fixture.detectChanges();
      expect(hostClasses()).toEqual(expect.arrayContaining(['dbx-button-floating', 'dbx-button-floating-left']));
      expect(hostClasses()).not.toContain('dbx-button-floating-fixed');
      expect(hostClasses()).not.toContain('dbx-button-floating-top');
    });
  });

  describe('offsets', () => {
    it('should not set the offset properties by default', () => {
      expect(hostOffset('x')).toBe('');
      expect(hostOffset('y')).toBe('');
    });

    it('should convert a number offset to pixels on both axes', () => {
      component.offset.set(24);
      fixture.detectChanges();
      expect(hostOffset('x')).toBe('24px');
      expect(hostOffset('y')).toBe('24px');
    });

    it('should pass a string offset through', () => {
      component.offset.set('var(--dbx-padding-5)');
      fixture.detectChanges();
      expect(hostOffset('x')).toBe('var(--dbx-padding-5)');
      expect(hostOffset('y')).toBe('var(--dbx-padding-5)');
    });

    it('should prefer the per-axis config offsets over the shared config offset', () => {
      component.config.set({ offset: 8, offsetY: '32px' });
      fixture.detectChanges();
      expect(hostOffset('x')).toBe('8px');
      expect(hostOffset('y')).toBe('32px');
    });

    it('should prefer the offset input over the config offsets', () => {
      component.config.set({ offsetX: 8, offsetY: 16 });
      component.offset.set(40);
      fixture.detectChanges();
      expect(hostOffset('x')).toBe('40px');
      expect(hostOffset('y')).toBe('40px');
    });
  });
});

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { DbxStyleDemoStyleLoaderDirective } from './style.loader.directive';
import { DbxStyleDemoStyleLoaderService } from './style.loader.service';
import { type DbxStyleDemoStyleLoaderInput } from './style.template';

@Component({
  template: `
    <div [dbxStyleDemoStyleLoader]="loaderInput()"></div>
  `,
  standalone: true,
  imports: [DbxStyleDemoStyleLoaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly loaderInput = signal<Maybe<DbxStyleDemoStyleLoaderInput>>(undefined);
}

/**
 * Returns the element carrying the loader directive.
 */
function loaderElement(fixture: ComponentFixture<TestHostComponent>): HTMLElement {
  return fixture.debugElement.query(By.directive(DbxStyleDemoStyleLoaderDirective)).nativeElement as HTMLElement;
}

describe('DbxStyleDemoStyleLoaderDirective', () => {
  describe('with the loader service (array-of-keys input)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [DbxStyleDemoStyleLoaderService]
      }).compileComponents();

      const service = TestBed.inject(DbxStyleDemoStyleLoaderService);
      service.register({ key: 'k1', style: { '--token-x': 'red' }, className: 'demo-class' });

      fixture = TestBed.createComponent(TestHostComponent);
      host = fixture.componentInstance;
    });

    it('should reflect a resolved key as inline style and class on the host element', async () => {
      host.loaderInput.set(['k1']);
      await fixture.whenStable();

      const el = loaderElement(fixture);
      expect(el.style.getPropertyValue('--token-x')).toContain('red');
      expect(el.classList.contains('demo-class')).toBe(true);
    });
  });

  describe('without the loader service (config-object input with inline templates)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: []
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      host = fixture.componentInstance;
    });

    it('should merge inline template objects and skip unresolvable string keys', async () => {
      host.loaderInput.set({ templates: ['unresolvable-key', { key: 'inline', style: { '--token-y': 'blue' }, className: 'inline-class' }] });
      await fixture.whenStable();

      const el = loaderElement(fixture);
      expect(el.style.getPropertyValue('--token-y')).toContain('blue');
      expect(el.classList.contains('inline-class')).toBe(true);
    });
  });
});

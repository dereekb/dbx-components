import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, signal, provideZonelessChangeDetection, type Type } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type FormConfig, DynamicForm, EventDispatcher, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { provideDbxForgeFormFieldDeclarations } from '../../forge.providers';
import { provideDbxFormConfiguration } from '../../../form.providers';
import { forgeComponentField } from './component.field';

// MARK: Loaded Tracker
const lastLoaded = signal<'a' | 'b' | undefined>(undefined);

// MARK: Test View Components
@Component({
  template: `
    <span>A</span>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestViewAComponent {
  constructor() {
    lastLoaded.set('a');
  }
}

@Component({
  template: `
    <span>B</span>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestViewBComponent {
  constructor() {
    lastLoaded.set('b');
  }
}

// MARK: Test Host
@Component({
  template: `
    @if (config) {
      <form [dynamic-form]="config" [(value)]="formValue"></form>
    }
  `,
  standalone: true,
  imports: [DynamicForm],
  providers: [EventDispatcher],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  config: Maybe<FormConfig>;
  readonly formValue = signal<any>({});
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), provideNoopAnimations(), { provide: DynamicFormLogger, useClass: NoopLogger }];
const SETTLE_TIME = 200;
const SETTLE_ROUNDS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(fixture: ComponentFixture<any>, rounds: number = SETTLE_ROUNDS): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    fixture.detectChanges();
    await delay(SETTLE_TIME);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  await delay(50);
  fixture.detectChanges();
}

function createConfig(componentClass: Type<unknown>): FormConfig {
  return {
    fields: [
      forgeComponentField({
        componentField: { componentClass }
      }) as any
    ]
  };
}

// MARK: Tests
describe('forgeComponentField rendering', () => {
  beforeEach(() => {
    lastLoaded.set(undefined);
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should load component A on initial render', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.config = createConfig(TestViewAComponent);
    await settle(fixture);

    expect(lastLoaded()).toBe('a');
    fixture.destroy();
  });

  it('should load component B on initial render', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.config = createConfig(TestViewBComponent);
    await settle(fixture);

    expect(lastLoaded()).toBe('b');
    fixture.destroy();
  });

  it('should produce unique keys per invocation so ng-forge treats config changes as new fields', () => {
    const configA = createConfig(TestViewAComponent);
    const configB = createConfig(TestViewBComponent);
    const keyA = (configA.fields[0] as any).key;
    const keyB = (configB.fields[0] as any).key;
    expect(keyA).not.toBe(keyB);
  });

  describe('config change via fresh fixture', () => {
    it('should load B when fixture starts with B config', async () => {
      const fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.config = createConfig(TestViewBComponent);
      await settle(fixture);

      expect(lastLoaded()).toBe('b');
      fixture.destroy();
    });

    it('should load A then B across separate fixtures', async () => {
      // First fixture: load A
      const fixtureA = TestBed.createComponent(TestHostComponent);
      fixtureA.componentInstance.config = createConfig(TestViewAComponent);
      await settle(fixtureA);
      expect(lastLoaded()).toBe('a');
      fixtureA.destroy();

      // Second fixture: load B
      lastLoaded.set(undefined);
      const fixtureB = TestBed.createComponent(TestHostComponent);
      fixtureB.componentInstance.config = createConfig(TestViewBComponent);
      await settle(fixtureB);
      expect(lastLoaded()).toBe('b');
      fixtureB.destroy();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type FormConfig, type FormOptions, DynamicForm, EventDispatcher, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { BehaviorSubject } from 'rxjs';
import { type Maybe, waitForMs } from '@dereekb/util';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { dbxForgeLayoutBoxesField } from './layoutboxes.field';
import { DbxForgeLayoutBoxesFieldComponent } from './layoutboxes.field.component';
import { type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesValue } from '../../../../field/value/layoutboxes/layoutboxes';
import { DbxLayoutBoxesComponent } from '../../../../field/value/layoutboxes/layoutboxes.component';

interface TestData {
  readonly kind: 'person' | 'thing';
}

const TEST_BOXES: DbxLayoutBoxesValue<TestData> = [
  { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, data: { kind: 'person' } },
  { box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, data: { kind: 'thing' } }
];

@Component({
  template: `
    @if (config) {
      <form [dynamic-form]="config" [(value)]="formValue" [formOptions]="formOptions()"></form>
    }
  `,
  imports: [DynamicForm],
  providers: [EventDispatcher]
})
class TestForgeLayoutBoxesHostComponent {
  config!: FormConfig;
  readonly formValue = signal<any>({});
  readonly formOptions = signal<FormOptions | undefined>(undefined);
}

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

describe('DbxForgeLayoutBoxesFieldComponent', () => {
  let fixture: ComponentFixture<TestForgeLayoutBoxesHostComponent>;
  let host: TestForgeLayoutBoxesHostComponent;

  async function settle(ms = 300): Promise<void> {
    fixture.detectChanges();
    await waitForMs(ms);
    fixture.detectChanges();
    await waitForMs(50);
    fixture.detectChanges();
  }

  function getEditor(): Maybe<DbxLayoutBoxesComponent<TestData>> {
    return fixture.debugElement.query(By.directive(DbxLayoutBoxesComponent))?.componentInstance as Maybe<DbxLayoutBoxesComponent<TestData>>;
  }

  function getFieldComponent(): Maybe<DbxForgeLayoutBoxesFieldComponent<TestData>> {
    return fixture.debugElement.query(By.directive(DbxForgeLayoutBoxesFieldComponent))?.componentInstance as Maybe<DbxForgeLayoutBoxesFieldComponent<TestData>>;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeLayoutBoxesHostComponent],
      providers: TEST_PROVIDERS
    });

    fixture = TestBed.createComponent(TestForgeLayoutBoxesHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('should render dbx-layout-boxes with the seeded boxes', async () => {
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', value: TEST_BOXES })] };
    await settle();

    const editor = getEditor();
    expect(editor).toBeDefined();
    expect(editor!.valueSignal().length).toBe(2);
    expect(fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-box')).length).toBe(2);
  });

  it('should write an edit from the editor to the form value', async () => {
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', value: TEST_BOXES })] };
    await settle();

    const box = fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-box'))[1].nativeElement as HTMLElement;
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle(50);

    const boxes = host.formValue().boxes as DbxLayoutBoxesValue<TestData>;
    expect(boxes.length).toBe(2);
    expect(boxes[1].box.x).toBe(0.51);
    expect(boxes[1].data).toEqual({ kind: 'thing' });
  });

  it('should show the editor readonly for a readonly field', async () => {
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', value: TEST_BOXES, readonly: true })] };
    await settle();
    expect(getFieldComponent()!.readonlySignal()).toBe(true);
    expect(getEditor()!.readonlySignal()).toBe(true);
  });

  it('should show the editor readonly when the form is disabled', async () => {
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', value: TEST_BOXES })] };
    host.formOptions.set({ disabled: true });
    await settle();
    expect(getEditor()!.readonlySignal()).toBe(true);
  });

  it('should render no boxes for an unseeded field', async () => {
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes' })] };
    await settle();
    expect(getEditor()!.valueSignal()).toEqual([]);
    expect(fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-box')).length).toBe(0);
  });

  it('should update the canvas ratio when an observable canvas emits', async () => {
    const canvas$ = new BehaviorSubject<DbxLayoutBoxesCanvasSize>({ width: 1, height: 1 });
    host.config = { fields: [dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', props: { canvas: canvas$ } })] };
    await settle();

    const canvasElement = fixture.debugElement.query(By.css('.dbx-layout-boxes-canvas')).nativeElement as HTMLElement;
    expect(Number.parseFloat(canvasElement.style.getPropertyValue('--dbx-layout-boxes-canvas-ratio-current'))).toBeCloseTo(1, 5);

    canvas$.next({ width: 16, height: 9 });
    await settle(50);
    expect(Number.parseFloat(canvasElement.style.getPropertyValue('--dbx-layout-boxes-canvas-ratio-current'))).toBeCloseTo(16 / 9, 5);
  });
});

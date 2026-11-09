/**
 * Form-pipeline scenarios for the layout boxes forge field.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { waitForMs } from '@dereekb/util';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { dbxForgeLayoutBoxesField, type DbxForgeLayoutBoxesFieldConfig } from './layoutboxes.field';
import { type DbxLayoutBoxesValue } from '../../../../field/value/layoutboxes/layoutboxes';

interface TestData {
  readonly kind: 'person' | 'thing';
  readonly label?: string;
}

interface TestFormValue {
  readonly boxes: DbxLayoutBoxesValue<TestData>;
}

function makeBoxes(count: number): DbxLayoutBoxesValue<TestData> {
  const boxes: DbxLayoutBoxesValue<TestData> = [];

  for (let i = 0; i < count; i += 1) {
    boxes.push({ box: { x: 0.1 * i, y: 0.1, w: 0.1, h: 0.2 }, data: { kind: i % 2 === 0 ? 'person' : 'thing', label: `Box ${i + 1}` } });
  }

  return boxes;
}

describe('dbxForgeLayoutBoxesField() scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent<TestFormValue>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent<TestFormValue>);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  async function settle(ms = 50): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForMs(ms);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function render(config: Partial<DbxForgeLayoutBoxesFieldConfig<TestData>> = {}): Promise<void> {
    const field = dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', ...config });
    fixture.componentInstance.config.set({ fields: [field] });
    await settle(100);
  }

  async function setBoxes(boxes: DbxLayoutBoxesValue<TestData>): Promise<void> {
    fixture.componentInstance.setValue({ boxes });
    await settle();
  }

  async function getStatus(): Promise<string> {
    return (await firstValueFrom(fixture.componentInstance.context.stream$)).status;
  }

  it('should output an empty array when no value is set', async () => {
    await render();
    const value = await firstValueFrom(fixture.componentInstance.getValue());
    expect(value).toEqual({ boxes: [] });
  });

  it('should round trip boxes with payloads', async () => {
    await render();
    const boxes = makeBoxes(2);
    await setBoxes(boxes);
    const value = await firstValueFrom(fixture.componentInstance.getValue());
    expect(JSON.stringify(value)).toBe(JSON.stringify({ boxes }));
  });

  it('should be invalid when empty with minLength 1, and valid with one box', async () => {
    await render({ minLength: 1 });
    expect(await getStatus()).toBe('INVALID');

    await setBoxes(makeBoxes(1));
    expect(await getStatus()).toBe('VALID');
  });

  it('should be invalid past maxLength', async () => {
    await render({ maxLength: 2 });
    await setBoxes(makeBoxes(2));
    expect(await getStatus()).toBe('VALID');

    await setBoxes(makeBoxes(3));
    expect(await getStatus()).toBe('INVALID');
  });

  it('should strip empty payload values from the output', async () => {
    await render();
    const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    await setBoxes([{ box, data: { kind: 'thing', label: '' } }]);
    const value = await firstValueFrom(fixture.componentInstance.getValue());
    expect(value).toEqual({ boxes: [{ box, data: { kind: 'thing' } }] });
  });
});

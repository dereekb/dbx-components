import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, signal, provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type CdkDragDrop } from '@angular/cdk/drag-drop';
import { DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { DbxForgeArrayFieldComponent } from './array.field.component';
import type { DbxForgeArrayFieldProps, DbxForgeArrayItemPair } from './array.field';

// MARK: Mock
/**
 * Creates a mock FieldTree that satisfies the component's field input.
 */
function createMockFieldTree(initialValues: unknown[] = []) {
  const valueSignal = signal<unknown[]>(initialValues);

  const fieldState = {
    value: valueSignal,
    markAsTouched: vi.fn(),
    markAsDirty: vi.fn()
  };

  // FieldTree is a callable that returns the field state
  const fieldTree = () => fieldState;
  return { fieldTree, fieldState, valueSignal };
}

function createMockDragEvent(previousIndex: number, currentIndex: number): CdkDragDrop<unknown> {
  return { previousIndex, currentIndex } as CdkDragDrop<unknown>;
}

// MARK: Test Host
@Component({
  template: `
    <dbx-forge-array-field [field]="fieldTree" [key]="'items'" [props]="props()" />
  `,
  standalone: true,
  imports: [DbxForgeArrayFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  fieldTree: any;
  readonly props = signal<DbxForgeArrayFieldProps | undefined>(undefined);
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideNoopAnimations(), { provide: DynamicFormLogger, useClass: NoopLogger }];

async function settle(fixture: ComponentFixture<any>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function getDragArrayComponent(fixture: ComponentFixture<TestHostComponent>): DbxForgeArrayFieldComponent {
  const el = fixture.debugElement.children[0];
  return el.componentInstance as DbxForgeArrayFieldComponent;
}

// MARK: Tests
describe('DbxForgeArrayFieldComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let mock: ReturnType<typeof createMockFieldTree>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: TEST_PROVIDERS
    });

    mock = createMockFieldTree();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    host.fieldTree = mock.fieldTree;
    await settle(fixture);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('addItem()', () => {
    it('should add an item with empty value', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();

      expect(comp.itemsSignal().length).toBe(1);
      expect(comp.itemsSignal()[0].value).toEqual({});
    });

    it('should sync to field tree after adding', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();

      expect(mock.fieldState.value()).toEqual([{}]);
      expect(mock.fieldState.markAsTouched).toHaveBeenCalled();
      expect(mock.fieldState.markAsDirty).toHaveBeenCalled();
    });

    it('should add multiple items with unique trackIds', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.addItem();

      expect(comp.itemsSignal().length).toBe(3);
      const ids = comp.itemsSignal().map((i) => i.trackId);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('removeItem()', () => {
    it('should remove item at the given index', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.addItem();

      const secondTrackId = comp.itemsSignal()[1].trackId;
      comp.removeItem(1);

      expect(comp.itemsSignal().length).toBe(2);
      expect(comp.itemsSignal().find((i) => i.trackId === secondTrackId)).toBeUndefined();
    });

    it('should sync to field tree after removing', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      mock.fieldState.markAsDirty.mockClear();
      mock.fieldState.markAsTouched.mockClear();

      comp.removeItem(0);

      expect(mock.fieldState.value().length).toBe(1);
      expect(mock.fieldState.markAsTouched).toHaveBeenCalled();
      expect(mock.fieldState.markAsDirty).toHaveBeenCalled();
    });
  });

  describe('duplicateItem()', () => {
    it('should insert duplicate after the source by default', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.onItemValueChange(0, { name: 'Alice' });

      comp.duplicateItem(0);

      expect(comp.itemsSignal().length).toBe(2);
      expect(comp.itemsSignal()[1].value).toEqual({ name: 'Alice' });
      // Should be a deep clone, not same reference
      expect(comp.itemsSignal()[1].value).not.toBe(comp.itemsSignal()[0].value);
      expect(comp.itemsSignal()[1].trackId).not.toBe(comp.itemsSignal()[0].trackId);
    });

    it('should add duplicate to end when addDuplicateToEnd is true', async () => {
      host.props.set({ template: [], addDuplicateToEnd: true } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.onItemValueChange(0, { name: 'First' });
      comp.onItemValueChange(1, { name: 'Second' });

      comp.duplicateItem(0);

      expect(comp.itemsSignal().length).toBe(3);
      expect(comp.itemsSignal()[2].value).toEqual({ name: 'First' });
    });

    it('should do nothing for invalid index', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.duplicateItem(5);

      expect(comp.itemsSignal().length).toBe(1);
    });
  });

  describe('drop()', () => {
    it('should reorder items when dropped at a new position', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.addItem();
      comp.onItemValueChange(0, { name: 'A' });
      comp.onItemValueChange(1, { name: 'B' });
      comp.onItemValueChange(2, { name: 'C' });

      // Move item 0 to position 2
      comp.drop(createMockDragEvent(0, 2));

      const values = comp.itemsSignal().map((i) => i.value);
      expect(values).toEqual([{ name: 'B' }, { name: 'C' }, { name: 'A' }]);
    });

    it('should sync to field tree after drop', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.onItemValueChange(0, { name: 'A' });
      comp.onItemValueChange(1, { name: 'B' });
      mock.fieldState.markAsDirty.mockClear();
      mock.fieldState.markAsTouched.mockClear();

      comp.drop(createMockDragEvent(0, 1));

      expect(mock.fieldState.value()).toEqual([{ name: 'B' }, { name: 'A' }]);
      expect(mock.fieldState.markAsTouched).toHaveBeenCalled();
      expect(mock.fieldState.markAsDirty).toHaveBeenCalled();
    });

    it('should handle drop to same position', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.onItemValueChange(0, { name: 'A' });
      comp.onItemValueChange(1, { name: 'B' });

      comp.drop(createMockDragEvent(0, 0));

      const values = comp.itemsSignal().map((i) => i.value);
      expect(values).toEqual([{ name: 'A' }, { name: 'B' }]);
    });

    it('should move last item to first position', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      comp.addItem();
      comp.onItemValueChange(0, { name: 'A' });
      comp.onItemValueChange(1, { name: 'B' });
      comp.onItemValueChange(2, { name: 'C' });

      comp.drop(createMockDragEvent(2, 0));

      const values = comp.itemsSignal().map((i) => i.value);
      expect(values).toEqual([{ name: 'C' }, { name: 'A' }, { name: 'B' }]);
    });
  });

  describe('onItemValueChange()', () => {
    it('should update the item value at the given index', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();

      comp.onItemValueChange(0, { name: 'Updated' });

      expect(comp.itemsSignal()[0].value).toEqual({ name: 'Updated' });
    });

    it('should preserve trackId when updating value', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      const trackId = comp.itemsSignal()[0].trackId;

      comp.onItemValueChange(0, { name: 'Updated' });

      expect(comp.itemsSignal()[0].trackId).toBe(trackId);
    });

    it('should not change items for invalid index', async () => {
      const comp = getDragArrayComponent(fixture);
      comp.addItem();

      comp.onItemValueChange(5, { name: 'Ghost' });

      expect(comp.itemsSignal().length).toBe(1);
      expect(comp.itemsSignal()[0].value).toEqual({});
    });
  });

  describe('labelForItem()', () => {
    it('should return index-only label when no labelForField', async () => {
      const comp = getDragArrayComponent(fixture);
      expect(comp.labelForItem(0, {})).toBe('1.');
      expect(comp.labelForItem(2, {})).toBe('3.');
    });

    it('should use static string labelForField', async () => {
      host.props.set({ template: [], labelForField: 'Item' } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      expect(comp.labelForItem(0, {})).toBe('1. Item');
    });

    it('should use function labelForField', async () => {
      host.props.set({
        template: [],
        labelForField: (pair: DbxForgeArrayItemPair) => (pair.value as { name: string })?.name ?? 'unnamed'
      } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      expect(comp.labelForItem(0, { name: 'Alice' })).toBe('1. Alice');
      expect(comp.labelForItem(1, {})).toBe('2. unnamed');
    });
  });

  describe('showAddButtonSignal', () => {
    it('should be true by default', async () => {
      const comp = getDragArrayComponent(fixture);
      expect(comp.showAddButtonSignal()).toBe(true);
    });

    it('should be false when allowAdd is false', async () => {
      host.props.set({ template: [], allowAdd: false } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      expect(comp.showAddButtonSignal()).toBe(false);
    });

    it('should be false when maxLength is reached', async () => {
      host.props.set({ template: [], maxLength: 2 } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      comp.addItem();
      expect(comp.showAddButtonSignal()).toBe(false);
    });

    it('should be true when under maxLength', async () => {
      host.props.set({ template: [], maxLength: 2 } as DbxForgeArrayFieldProps);
      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      comp.addItem();
      expect(comp.showAddButtonSignal()).toBe(true);
    });
  });

  describe('initialization from field values', () => {
    it('should initialize items from field tree initial values', async () => {
      // Reset and create fresh fixture with pre-populated values
      fixture.destroy();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: TEST_PROVIDERS
      });

      const initMock = createMockFieldTree([{ name: 'Pre-existing' }]);
      fixture = TestBed.createComponent(TestHostComponent);
      host = fixture.componentInstance;
      host.fieldTree = initMock.fieldTree;

      await settle(fixture);

      const comp = getDragArrayComponent(fixture);
      expect(comp.itemsSignal().length).toBe(1);
      expect(comp.itemsSignal()[0].value).toEqual({ name: 'Pre-existing' });
    });
  });
});

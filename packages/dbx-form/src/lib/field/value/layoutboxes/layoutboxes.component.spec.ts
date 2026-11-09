import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxLayoutBoxesValue } from './layoutboxes';
import { type DbxLayoutBoxesComponentConfig, DbxLayoutBoxesComponent } from './layoutboxes.component';
import { DbxLayoutBoxesCanvasComponent } from './layoutboxes.canvas.component';
import { AbstractDbxLayoutBoxesItemDirective } from './layoutboxes.item';

interface TestData {
  readonly kind: 'person' | 'thing';
  readonly label?: Maybe<string>;
}

@Component({
  template: `
    <input class="test-row-input" [value]="dataSignal().label ?? ''" [readonly]="readonlySignal()" (input)="onInput($event)" />
  `
})
class TestLayoutBoxRowComponent extends AbstractDbxLayoutBoxesItemDirective<TestData> {
  onInput(event: Event): void {
    this.setData({ ...this.dataSignal(), label: (event.target as HTMLInputElement).value });
  }
}

const TEST_ROW_ITEM: DbxInjectionComponentConfig = { componentClass: TestLayoutBoxRowComponent };
const TEST_NEW_BOX = { x: 0.4, y: 0.4, w: 0.1, h: 0.1 };

function makeItems(): DbxLayoutBoxesValue<TestData> {
  return [
    { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 }, data: { kind: 'person', label: 'A' } },
    { box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, data: { kind: 'thing', label: 'B' } },
    { box: { x: 0.6, y: 0.1, w: 0.2, h: 0.5 }, data: { kind: 'person', label: 'C' } }
  ];
}

function makeConfig(): DbxLayoutBoxesComponentConfig<TestData> {
  return {
    item: TEST_ROW_ITEM,
    itemStyle: (item) => ({ cssClasses: [`test-box-${item.data.kind}`], color: item.data.kind === 'person' ? 'primary' : 'accent' }),
    addOptions: [{ text: 'Add thing', icon: 'add_box', box: TEST_NEW_BOX, data: () => ({ kind: 'thing' }) }],
    cap: { max: 1, countFilter: (item) => item.data.kind === 'person', warning: (count, max) => `${count} people: past the cap of ${max}.` }
  };
}

@Component({
  template: `
    <dbx-layout-boxes [config]="config()" [readonly]="readonly()" [(value)]="value" [(selectedIndex)]="selectedIndex"></dbx-layout-boxes>
  `,
  imports: [DbxLayoutBoxesComponent]
})
class TestLayoutBoxesHostComponent {
  readonly config = signal<DbxLayoutBoxesComponentConfig<TestData>>(makeConfig());
  readonly readonly = signal<Maybe<boolean>>(undefined);
  readonly value = signal<Maybe<DbxLayoutBoxesValue<TestData>>>(makeItems());
  readonly selectedIndex = signal<Maybe<number>>(undefined);
}

describe('DbxLayoutBoxesComponent', () => {
  let fixture: ComponentFixture<TestLayoutBoxesHostComponent>;
  let host: TestLayoutBoxesHostComponent;

  function rowElements(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-item')).map((x) => x.nativeElement as HTMLElement);
  }

  function boxElements(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-box')).map((x) => x.nativeElement as HTMLElement);
  }

  function rowComponents(): TestLayoutBoxRowComponent[] {
    return fixture.debugElement.queryAll(By.directive(TestLayoutBoxRowComponent)).map((x) => x.componentInstance as TestLayoutBoxRowComponent);
  }

  function clickRemove(index: number): void {
    const button = rowElements()[index].querySelector('.dbx-layout-boxes-item-remove button') as HTMLElement;
    button.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestLayoutBoxesHostComponent],
      providers: [provideZonelessChangeDetection()]
    });

    fixture = TestBed.createComponent(TestLayoutBoxesHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('rows', () => {
    it('should render one row with a row component per box', () => {
      const rows = rowElements();
      expect(rows.length).toBe(3);
      expect(rowComponents().length).toBe(3);
      expect(rows.map((x) => x.querySelector('dbx-chip')?.textContent?.trim())).toEqual(['1', '2', '3']);
    });

    it('should write only the edited box payload, and keep the row component', () => {
      const before = makeItems();
      host.value.set(before);
      fixture.detectChanges();

      const componentBefore = rowComponents()[0];
      const input = rowElements()[0].querySelector('.test-row-input') as HTMLInputElement;
      input.value = 'Z';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const value = host.value() as DbxLayoutBoxesValue<TestData>;
      expect(value).not.toBe(before);
      expect(value[0].data).toEqual({ kind: 'person', label: 'Z' });
      expect(value[0].box).toBe(before[0].box);
      expect(value[1]).toBe(before[1]);
      expect(value[2]).toBe(before[2]);
      expect(rowComponents()[0]).toBe(componentBefore);
    });
  });

  describe('selection', () => {
    it('should select the box when a row is clicked', () => {
      rowElements()[1].click();
      fixture.detectChanges();
      expect(host.selectedIndex()).toBe(1);
      expect(boxElements()[1].classList.contains('dbx-layout-boxes-box-selected')).toBe(true);
      expect(rowElements()[1].classList.contains('dbx-layout-boxes-item-selected')).toBe(true);
      expect(rowComponents()[1].selectedSignal()).toBe(true);
    });

    it('should select the row when a box is focused', () => {
      boxElements()[2].dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      expect(host.selectedIndex()).toBe(2);
      expect(rowElements()[2].classList.contains('dbx-layout-boxes-item-selected')).toBe(true);
    });

    it('should read an out-of-range selection as none', () => {
      host.selectedIndex.set(10);
      fixture.detectChanges();
      expect(rowElements().some((x) => x.classList.contains('dbx-layout-boxes-item-selected'))).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove the box', () => {
      clickRemove(1);
      const value = host.value() as DbxLayoutBoxesValue<TestData>;
      expect(value.length).toBe(2);
      expect(value.map((x) => x.data.label)).toEqual(['A', 'C']);
      expect(rowElements().length).toBe(2);
    });

    it('should clear the selection when the selected box is removed', () => {
      host.selectedIndex.set(1);
      fixture.detectChanges();
      clickRemove(1);
      expect(host.selectedIndex()).toBeUndefined();
    });

    it('should shift the selection when a box before it is removed, without the row click selecting', () => {
      host.selectedIndex.set(2);
      fixture.detectChanges();
      clickRemove(0);
      expect(host.selectedIndex()).toBe(1);
    });
  });

  describe('add', () => {
    it('should render one button per add option and append a new box when clicked', () => {
      const buttons = fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-add dbx-button'));
      expect(buttons.length).toBe(1);

      (buttons[0].nativeElement.querySelector('button') as HTMLElement).click();
      fixture.detectChanges();

      const value = host.value() as DbxLayoutBoxesValue<TestData>;
      expect(value.length).toBe(4);
      expect(value[3]).toEqual({ box: TEST_NEW_BOX, data: { kind: 'thing' } });
      expect(host.selectedIndex()).toBe(3);
    });
  });

  describe('cap', () => {
    it('should show the warning when the counted boxes pass the cap', () => {
      const warning = fixture.debugElement.query(By.css('.dbx-layout-boxes-cap-warning'));
      expect(warning).not.toBeNull();
      expect((warning.nativeElement as HTMLElement).textContent?.trim()).toBe('2 people: past the cap of 1.');
    });

    it('should not show the warning at or under the cap', () => {
      host.value.set(makeItems().slice(0, 2));
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.dbx-layout-boxes-cap-warning'))).toBeNull();
    });

    it('should still add boxes past the cap', () => {
      const button = fixture.debugElement.query(By.css('.dbx-layout-boxes-add dbx-button button')).nativeElement as HTMLElement;
      button.click();
      fixture.detectChanges();
      expect((host.value() as DbxLayoutBoxesValue<TestData>).length).toBe(4);
    });
  });

  describe('readonly', () => {
    beforeEach(() => {
      host.readonly.set(true);
      fixture.detectChanges();
    });

    it('should hide the add bar and the remove buttons', () => {
      expect(fixture.debugElement.query(By.css('.dbx-layout-boxes-add'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.dbx-layout-boxes-item-remove'))).toBeNull();
      expect(rowElements().length).toBe(3);
    });

    it('should mark the rows and the canvas readonly', () => {
      expect(rowComponents().every((x) => x.readonlySignal())).toBe(true);
      const canvas = fixture.debugElement.query(By.directive(DbxLayoutBoxesCanvasComponent)).componentInstance as DbxLayoutBoxesCanvasComponent;
      expect(canvas.readonlySignal()).toBe(true);
    });
  });

  describe('styling', () => {
    it('should apply the item style classes to the row and the color to its chip', () => {
      const rows = rowElements();
      expect(rows[0].classList.contains('test-box-person')).toBe(true);
      expect(rows[0].classList.contains('dbx-layout-boxes-item')).toBe(true);
      expect(rows[1].classList.contains('test-box-thing')).toBe(true);
      expect(rows[0].querySelector('dbx-chip')?.classList.contains('dbx-color')).toBe(true);
    });
  });

  describe('robustness', () => {
    it('should render no rows for a value that is not an array', () => {
      host.value.set('' as unknown as DbxLayoutBoxesValue<TestData>);
      fixture.detectChanges();
      expect(rowElements().length).toBe(0);

      host.value.set(null);
      fixture.detectChanges();
      expect(rowElements().length).toBe(0);
    });

    it('should show "Box N" without an item config', () => {
      host.config.set({ ...makeConfig(), item: undefined });
      fixture.detectChanges();
      const rows = rowElements();
      expect(rows[0].querySelector('.dbx-layout-boxes-item-default')?.textContent?.trim()).toBe('Box 1');
      expect(rowComponents().length).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type Maybe } from '@dereekb/util';
import { type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesItemStyleFunction, type DbxLayoutBoxesValue } from './layoutboxes';
import { type DbxLayoutBoxesBoxChange, DbxLayoutBoxesCanvasComponent } from './layoutboxes.canvas.component';

interface TestData {
  readonly kind: 'person' | 'thing';
}

function makeItems(): DbxLayoutBoxesValue<TestData> {
  return [
    { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, data: { kind: 'person' } },
    { box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, data: { kind: 'thing' } }
  ];
}

@Component({
  template: `
    <dbx-layout-boxes-canvas [items]="items()" [canvas]="canvas()" [imageUrl]="imageUrl()" [itemStyle]="itemStyle()" [readonly]="readonly()" [(selectedIndex)]="selectedIndex" (boxChange)="changes.push($event)"></dbx-layout-boxes-canvas>
  `,
  imports: [DbxLayoutBoxesCanvasComponent]
})
class TestLayoutBoxesCanvasHostComponent {
  readonly items = signal<DbxLayoutBoxesValue<TestData>>(makeItems());
  readonly canvas = signal<Maybe<DbxLayoutBoxesCanvasSize>>(undefined);
  readonly imageUrl = signal<Maybe<string>>(undefined);
  readonly itemStyle = signal<Maybe<DbxLayoutBoxesItemStyleFunction<TestData>>>(undefined);
  readonly readonly = signal<Maybe<boolean>>(undefined);
  readonly selectedIndex = signal<Maybe<number>>(undefined);
  readonly changes: DbxLayoutBoxesBoxChange[] = [];
}

function makePointerEvent(type: string, clientX: number, clientY: number): Event {
  const init = { clientX, clientY, pointerId: 1, bubbles: true, cancelable: true };
  return typeof PointerEvent === 'undefined' ? new MouseEvent(type, init) : new PointerEvent(type, init);
}

describe('DbxLayoutBoxesCanvasComponent', () => {
  let fixture: ComponentFixture<TestLayoutBoxesCanvasHostComponent>;
  let host: TestLayoutBoxesCanvasHostComponent;

  function canvasElement(): HTMLElement {
    return fixture.debugElement.query(By.css('.dbx-layout-boxes-canvas')).nativeElement as HTMLElement;
  }

  function boxElements(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('.dbx-layout-boxes-box')).map((x) => x.nativeElement as HTMLElement);
  }

  function stubCanvasRect(): void {
    canvasElement().getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestLayoutBoxesCanvasHostComponent],
      providers: [provideZonelessChangeDetection()]
    });

    fixture = TestBed.createComponent(TestLayoutBoxesCanvasHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('rendering', () => {
    it('should render one numbered box per item at its percentage position', () => {
      const boxes = boxElements();
      expect(boxes.length).toBe(2);
      expect(boxes[0].style.left).toBe('10%');
      expect(boxes[0].style.top).toBe('10%');
      expect(boxes[0].style.width).toBe('20%');
      expect(boxes[0].style.height).toBe('20%');
      expect(boxes[1].style.left).toBe('50%');
      expect(boxes[0].querySelector('.dbx-layout-boxes-box-number')?.textContent?.trim()).toBe('1');
      expect(boxes[1].querySelector('.dbx-layout-boxes-box-number')?.textContent?.trim()).toBe('2');
    });

    it('should set the canvas ratio token from the canvas size', () => {
      host.canvas.set({ width: 16, height: 9 });
      fixture.detectChanges();
      const ratio = Number.parseFloat(canvasElement().style.getPropertyValue('--dbx-layout-boxes-canvas-ratio-current'));
      expect(ratio).toBeCloseTo(16 / 9, 5);
    });

    it('should render the image when an image url is set', () => {
      expect(fixture.debugElement.query(By.css('.dbx-layout-boxes-canvas-image'))).toBeNull();
      host.imageUrl.set('https://example.com/picture.png');
      fixture.detectChanges();
      const image = fixture.debugElement.query(By.css('.dbx-layout-boxes-canvas-image'));
      expect(image).not.toBeNull();
      expect((image.nativeElement as HTMLImageElement).getAttribute('alt')).toBe('');
    });
  });

  describe('handles and readonly', () => {
    it('should render four handles on the selected box only', () => {
      host.selectedIndex.set(0);
      fixture.detectChanges();
      const boxes = boxElements();
      expect(boxes[0].querySelectorAll('.dbx-layout-boxes-handle').length).toBe(4);
      expect(boxes[1].querySelectorAll('.dbx-layout-boxes-handle').length).toBe(0);
      expect(boxes[0].classList.contains('dbx-layout-boxes-box-selected')).toBe(true);
    });

    it('should render no handles or tabindex when readonly, and ignore pointerdown', () => {
      host.readonly.set(true);
      host.selectedIndex.set(0);
      fixture.detectChanges();
      stubCanvasRect();
      const boxes = boxElements();
      expect(boxes[0].querySelectorAll('.dbx-layout-boxes-handle').length).toBe(0);
      expect(boxes[0].getAttribute('tabindex')).toBeNull();

      boxes[1].dispatchEvent(makePointerEvent('pointerdown', 120, 60));
      boxes[1].dispatchEvent(makePointerEvent('pointermove', 140, 70));
      boxes[1].dispatchEvent(makePointerEvent('pointerup', 140, 70));
      fixture.detectChanges();

      expect(host.selectedIndex()).toBe(0);
      expect(host.changes.length).toBe(0);
    });
  });

  describe('drag', () => {
    it('should move a box and emit the change on drop', () => {
      stubCanvasRect();
      const box = boxElements()[0];
      box.dispatchEvent(makePointerEvent('pointerdown', 20, 20));
      box.dispatchEvent(makePointerEvent('pointermove', 40, 30));
      fixture.detectChanges();
      expect(boxElements()[0].style.left).toBe('20%');

      box.dispatchEvent(makePointerEvent('pointerup', 40, 30));
      fixture.detectChanges();

      expect(host.selectedIndex()).toBe(0);
      expect(host.changes).toEqual([{ index: 0, box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } }]);
    });

    it('should not emit when the box did not move', () => {
      stubCanvasRect();
      const box = boxElements()[0];
      box.dispatchEvent(makePointerEvent('pointerdown', 20, 20));
      box.dispatchEvent(makePointerEvent('pointerup', 20, 20));
      expect(host.changes.length).toBe(0);
    });

    it('should resize a box from a corner handle', () => {
      host.selectedIndex.set(0);
      fixture.detectChanges();
      stubCanvasRect();
      const handle = boxElements()[0].querySelector('.dbx-layout-boxes-handle-se') as HTMLElement;
      handle.dispatchEvent(makePointerEvent('pointerdown', 60, 30));
      handle.dispatchEvent(makePointerEvent('pointermove', 80, 40));
      handle.dispatchEvent(makePointerEvent('pointerup', 80, 40));
      expect(host.changes).toEqual([{ index: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }]);
    });
  });

  describe('keyboard', () => {
    function keydown(index: number, init: KeyboardEventInit): void {
      boxElements()[index].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
    }

    it('should nudge a box with the arrow keys', () => {
      keydown(1, { key: 'ArrowRight' });
      expect(host.changes).toEqual([{ index: 1, box: { x: 0.51, y: 0.5, w: 0.2, h: 0.2 } }]);
      expect(host.selectedIndex()).toBe(1);
    });

    it('should step further with Shift', () => {
      keydown(1, { key: 'ArrowUp', shiftKey: true });
      expect(host.changes[0].box.y).toBe(0.45);
    });

    it('should resize with Alt', () => {
      keydown(1, { key: 'ArrowDown', altKey: true });
      expect(host.changes[0].box).toEqual({ x: 0.5, y: 0.5, w: 0.2, h: 0.21 });
    });

    it('should ignore other keys', () => {
      keydown(1, { key: 'Enter' });
      expect(host.changes.length).toBe(0);
    });
  });

  describe('selection', () => {
    it('should clear the selection on a pointerdown on the empty canvas', () => {
      host.selectedIndex.set(1);
      fixture.detectChanges();
      canvasElement().dispatchEvent(makePointerEvent('pointerdown', 190, 5));
      expect(host.selectedIndex()).toBeUndefined();
    });

    it('should select a box when it is focused', () => {
      boxElements()[1].dispatchEvent(new FocusEvent('focus'));
      expect(host.selectedIndex()).toBe(1);
    });
  });

  describe('styling', () => {
    it('should apply the item style classes and color to the box', () => {
      host.itemStyle.set((item) => ({ cssClasses: [`test-box-${item.data.kind}`], color: item.data.kind === 'person' ? 'primary' : 'accent' }));
      fixture.detectChanges();
      const boxes = boxElements();
      expect(boxes[0].classList.contains('dbx-layout-boxes-box')).toBe(true);
      expect(boxes[0].classList.contains('test-box-person')).toBe(true);
      expect(boxes[0].classList.contains('dbx-color')).toBe(true);
      expect(boxes[1].classList.contains('test-box-thing')).toBe(true);
    });
  });
});

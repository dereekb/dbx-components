import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef, inject } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { NgPopoverRef } from 'ng-overlay-container';
import { EMPTY } from 'rxjs';
import { DbxRouterTransitionService } from '@dereekb/dbx-core';
import { DbxPopoverComponent } from './popover.component';

@Component({
  template: ''
})
class TestPopoverContentComponent {}

interface TestPopoverRef {
  readonly close: ReturnType<typeof vi.fn>;
  readonly _close: ReturnType<typeof vi.fn>;
  readonly _overlay: Overlay;
  readonly overlay: { readonly updatePositionStrategy: ReturnType<typeof vi.fn> };
  readonly data: unknown;
}

describe('DbxPopoverComponent', () => {
  let fixture: ComponentFixture<DbxPopoverComponent>;
  let popoverRef: TestPopoverRef;
  let refClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refClose = vi.fn();

    TestBed.configureTestingModule({
      imports: [DbxPopoverComponent],
      providers: [
        { provide: DbxRouterTransitionService, useValue: { transitions$: EMPTY } },
        {
          provide: NgPopoverRef,
          useFactory: () => {
            popoverRef = {
              close: refClose,
              _close: vi.fn(),
              _overlay: inject(Overlay),
              overlay: { updatePositionStrategy: vi.fn() },
              data: {
                key: 'test',
                origin: new ElementRef(document.createElement('div')),
                componentClass: TestPopoverContentComponent,
                configuration: {}
              }
            };

            return popoverRef;
          }
        }
      ]
    });

    fixture = TestBed.createComponent(DbxPopoverComponent);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('close()', () => {
    it('should close right away when there is no closing value function', () => {
      fixture.componentInstance.close();
      expect(refClose).toHaveBeenCalledTimes(1);
    });

    it('should close right away with a closing value that is not a promise', () => {
      fixture.componentInstance.getClosingValueFn = () => 1;

      fixture.componentInstance.close();

      expect(refClose).toHaveBeenCalledTimes(1);
      expect(refClose).toHaveBeenCalledWith(1);
    });

    it('should close once a promised closing value resolves', async () => {
      let resolveClosingValue!: (value: unknown) => void;
      fixture.componentInstance.getClosingValueFn = () => new Promise((resolve) => (resolveClosingValue = resolve));

      fixture.componentInstance.close();
      expect(refClose).not.toHaveBeenCalled();

      resolveClosingValue(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(refClose).toHaveBeenCalledTimes(1);
      expect(refClose).toHaveBeenCalledWith(1);
    });

    it('should compute the closing value once when closed again while it is pending', () => {
      const getClosingValueFn = vi.fn(() => new Promise<unknown>(() => undefined));
      fixture.componentInstance.getClosingValueFn = getClosingValueFn;

      fixture.componentInstance.close();
      fixture.componentInstance.close();
      (popoverRef as unknown as { _close: (type: string, value: unknown) => void })._close('backdropClick', null);

      expect(getClosingValueFn).toHaveBeenCalledTimes(1);
      expect(refClose).not.toHaveBeenCalled();
    });

    it('should compute the closing value once when the closing value function closes the popover itself', () => {
      const getClosingValueFn = vi.fn(() => {
        fixture.componentInstance.close();
        return undefined;
      });

      fixture.componentInstance.getClosingValueFn = getClosingValueFn;
      fixture.componentInstance.close();

      expect(getClosingValueFn).toHaveBeenCalledTimes(1);
      expect(refClose).toHaveBeenCalledTimes(1);
    });
  });
});

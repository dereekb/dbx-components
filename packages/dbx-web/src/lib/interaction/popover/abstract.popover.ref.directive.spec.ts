import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { type NgPopoverCloseEvent, type NgPopoverRef } from 'ng-overlay-container';
import { Subject } from 'rxjs';
import { AbstractPopoverRefDirective } from './abstract.popover.ref.directive';

interface TestPopoverRef {
  readonly close: ReturnType<typeof vi.fn>;
  readonly afterClosed$: Subject<NgPopoverCloseEvent<unknown>>;
}

@Component({
  template: ''
})
class TestPopoverRefHostComponent extends AbstractPopoverRefDirective {
  readonly refs: TestPopoverRef[] = [];
  readonly afterClosedCalls: NgPopoverCloseEvent<unknown>[] = [];

  protected _makePopoverRef(): NgPopoverRef<unknown, unknown> {
    const ref: TestPopoverRef = { close: vi.fn(), afterClosed$: new Subject() };
    this.refs.push(ref);
    return ref as unknown as NgPopoverRef<unknown, unknown>;
  }

  protected override _afterClosed(value: NgPopoverCloseEvent<unknown>): void {
    this.afterClosedCalls.push(value);
  }
}

const TEST_CLOSE_EVENT = { type: 'close' } as NgPopoverCloseEvent<unknown>;

describe('AbstractPopoverRefDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestPopoverRefHostComponent] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should close the open popover when destroyed', () => {
    const fixture = TestBed.createComponent(TestPopoverRefHostComponent);
    const host = fixture.componentInstance;

    host.showPopover();
    expect(host.refs.length).toBe(1);

    fixture.destroy();
    expect(host.refs[0].close).toHaveBeenCalledTimes(1);
  });

  it('should not close anything when destroyed without an open popover', () => {
    const fixture = TestBed.createComponent(TestPopoverRefHostComponent);
    const host = fixture.componentInstance;

    expect(() => fixture.destroy()).not.toThrow();
    expect(host.refs.length).toBe(0);
  });

  it('should not close a popover that already closed', () => {
    const fixture = TestBed.createComponent(TestPopoverRefHostComponent);
    const host = fixture.componentInstance;

    host.showPopover();
    host.refs[0].afterClosed$.next(TEST_CLOSE_EVENT);
    expect(host.afterClosedCalls.length).toBe(1);

    fixture.destroy();
    expect(host.refs[0].close).not.toHaveBeenCalled();
  });

  it('should not call _afterClosed when the popover closes after the directive was destroyed', () => {
    const fixture = TestBed.createComponent(TestPopoverRefHostComponent);
    const host = fixture.componentInstance;

    host.showPopover();
    fixture.destroy();

    host.refs[0].afterClosed$.next(TEST_CLOSE_EVENT);
    expect(host.afterClosedCalls.length).toBe(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { delay, of } from 'rxjs';
import { type IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionDirective } from '../context/action.directive';
import { DbxActionValueDirective } from './action.value.directive';
import { DbxActionValueTriggerDirective } from './action.value.trigger.directive';
import { type DbxActionValueGetterValueGetterFunction } from './action.value.trigger.instance';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionContextMachineAsService } from '../../action.machine';

describe('DbxActionContextStoreSourceInstance.valueSnapshot()', () => {
  let source: DbxActionContextMachineAsService<number>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    source = TestBed.runInInjectionContext(() => new DbxActionContextMachineAsService<number>());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should return undefined when nothing is registered', () => {
    const instance = new DbxActionContextStoreSourceInstance(source);
    expect(instance.valueSnapshot()).toBeUndefined();
  });

  it('should share a registration between instances of the same action', () => {
    const a = new DbxActionContextStoreSourceInstance(source);
    const b = new DbxActionContextStoreSourceInstance(source);

    const unregister = a.registerValueSnapshot(() => ({ value: 1 }));
    expect(b.valueSnapshot()?.value).toBe(1);

    unregister();
    expect(b.valueSnapshot()).toBeUndefined();
  });

  it('should use the latest registration, and keep it when an earlier registration is removed', () => {
    const instance = new DbxActionContextStoreSourceInstance(source);

    const unregisterFirst = instance.registerValueSnapshot(() => ({ value: 1 }));
    const unregisterSecond = instance.registerValueSnapshot(() => ({ value: 2 }));
    expect(instance.valueSnapshot()?.value).toBe(2);

    unregisterFirst();
    expect(instance.valueSnapshot()?.value).toBe(2);

    unregisterSecond();
    expect(instance.valueSnapshot()).toBeUndefined();
  });
});

@Component({
  template: `
    <div dbxAction>
      @if (show()) {
        <ng-container [dbxActionValue]="value()"></ng-container>
      }
    </div>
  `,
  imports: [DbxActionDirective, DbxActionValueDirective]
})
class TestDbxActionValueSnapshotComponent {
  readonly directive = viewChild.required(DbxActionDirective);
  readonly show = signal(true);
  readonly value = signal<Maybe<number>>(1);
}

describe('DbxActionValueDirective.valueSnapshot()', () => {
  let fixture: ComponentFixture<TestDbxActionValueSnapshotComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxActionValueSnapshotComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  function sourceInstance(): DbxActionContextStoreSourceInstance<number> {
    return fixture.componentInstance.directive().sourceInstance as DbxActionContextStoreSourceInstance<number>;
  }

  it('should return the current value', () => {
    expect(sourceInstance().valueSnapshot()).toEqual({ value: 1 });

    fixture.componentInstance.value.set(2);
    fixture.detectChanges();

    expect(sourceInstance().valueSnapshot()).toEqual({ value: 2 });
  });

  it('should return undefined when there is no value', () => {
    fixture.componentInstance.value.set(undefined);
    fixture.detectChanges();

    expect(sourceInstance().valueSnapshot()).toBeUndefined();
  });

  it('should remove its registration when destroyed', () => {
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    expect(sourceInstance().valueSnapshot()).toBeUndefined();
  });
});

@Component({
  template: `
    <div dbxAction>
      <ng-container [dbxActionValueGetter]="valueGetter()" [dbxActionValueGetterIsModified]="isModified()"></ng-container>
    </div>
  `,
  imports: [DbxActionDirective, DbxActionValueTriggerDirective]
})
class TestDbxActionValueGetterSnapshotComponent {
  readonly directive = viewChild.required(DbxActionDirective);
  readonly valueGetter = signal<Maybe<DbxActionValueGetterValueGetterFunction<number>>>(() => 1);
  readonly isModified = signal<Maybe<IsModifiedFunction<number>>>(undefined);
}

describe('DbxActionValueTriggerDirective value snapshot', () => {
  let fixture: ComponentFixture<TestDbxActionValueGetterSnapshotComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxActionValueGetterSnapshotComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  function sourceInstance(): DbxActionContextStoreSourceInstance<number> {
    return fixture.componentInstance.directive().sourceInstance as DbxActionContextStoreSourceInstance<number>;
  }

  async function update(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should return the value from the value getter', () => {
    expect(sourceInstance().valueSnapshot()).toEqual({ value: 1 });
  });

  it('should return no value when the value is not modified', async () => {
    fixture.componentInstance.isModified.set(() => of(false));
    await update();

    expect(sourceInstance().valueSnapshot()?.value).toBeUndefined();
  });

  it('should return undefined when the value getter does not resolve synchronously', async () => {
    fixture.componentInstance.valueGetter.set(() => of(1).pipe(delay(10)));
    await update();

    expect(sourceInstance().valueSnapshot()).toBeUndefined();
  });
});

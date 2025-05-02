import { TestBed } from '@angular/core/testing';
import { Injectable, Injector, inject } from '@angular/core';
import { newWithInjector } from './injector';

@Injectable()
class TestInjectableClassA {
  readonly injector = inject(Injector);
}

@Injectable()
class TestInjectableClassB {
  readonly dependencyA = inject(TestInjectableClassA);
}

@Injectable()
class TestInjectableClassC {
  readonly dependencyB = inject(TestInjectableClassB);
}

describe('newWithInjector()', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [TestInjectableClassA, TestInjectableClassB]
    }).compileComponents();
  });

  it('should inject a new instance of class B that is different from the already provided value in the root', () => {
    const injector = TestBed.inject(Injector);
    const existing = TestBed.inject(TestInjectableClassB);
    const existingAgain = TestBed.inject(TestInjectableClassB);

    expect(existing).toBe(existingAgain);

    const newInstance = newWithInjector(TestInjectableClassB, injector);
    expect(newInstance).not.toBe(existing);
  });
});

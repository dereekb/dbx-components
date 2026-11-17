import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideDbxStorage } from '@dereekb/dbx-core';
import { type DbxLlmFlowConfig } from './llm.flow';
import { DbxLlmFlowDirective } from './llm.flow.directive';

@Component({
  template: `
    <div [dbxLlmFlow]="config" storageKey="dbx-llm-flow-directive-spec"></div>
  `,
  imports: [DbxLlmFlowDirective]
})
class TestDbxLlmFlowDirectiveHostComponent {
  readonly config: DbxLlmFlowConfig = { persistence: { debounceTime: 0 } };
  readonly flow = viewChild.required(DbxLlmFlowDirective);
}

describe('DbxLlmFlowDirective', () => {
  let fixture: ComponentFixture<TestDbxLlmFlowDirectiveHostComponent>;

  describe('with a SimpleStorageAccessorFactory', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [TestDbxLlmFlowDirectiveHostComponent], providers: [provideDbxStorage()] }).compileComponents();
      fixture = TestBed.createComponent(TestDbxLlmFlowDirectiveHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    afterEach(() => {
      fixture?.destroy();
    });

    it('should create the storage sync from its effect', () => {
      // regression: the sync used clean(), which needs an injection context the effect body does not have
      expect(fixture.componentInstance.flow().storageSync).toBeDefined();
    });
  });
});

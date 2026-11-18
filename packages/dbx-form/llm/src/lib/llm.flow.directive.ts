import { computed, DestroyRef, Directive, effect, inject, input, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { SimpleStorageAccessorFactory } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DBX_LLM_FLOW_STORAGE_PREFIX, type DbxLlmFlowConfig } from './llm.flow';
import { DbxLlmFlowStore } from './llm.flow.store';
import { type DbxLlmFlowPersistedState, DbxLlmFlowStorageSync } from './llm.flow.storage';

/**
 * Provides a DbxLlmFlowStore for the sections within it, and keeps it in sync with storage when a storage key is set.
 *
 * Persistence needs a SimpleStorageAccessorFactory (see provideDbxStorage()). Without one, the flow is not persisted.
 *
 * The directive adds no layout, so the sections can sit in any layout (columns, a grid). To stack them with the flow's gap, as dbx-llm-flow does,
 * add the dbx-llm-flow class.
 *
 * @dbxWebComponent
 * @dbxWebSlug llm-flow-host
 * @dbxWebCategory layout
 * @dbxWebRelated llm-flow-section, llm-flow
 * @dbxWebMinimalExample ```html
 * <div [dbxLlmFlow]="flowConfig" [storageKey]="worldKey()">
 *   <dbx-llm-flow-section [config]="briefConfig"></dbx-llm-flow-section>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <div class="dbx-llm-flow" [dbxLlmFlow]="flowConfig" [storageKey]="worldKey()">
 *   <dbx-llm-flow-section [config]="setupConfig"></dbx-llm-flow-section>
 *   <dbx-llm-flow-section [config]="briefConfig" parentKey="setup"></dbx-llm-flow-section>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxLlmFlow]',
  exportAs: 'dbxLlmFlow',
  providers: [DbxLlmFlowStore],
  standalone: true
})
export class DbxLlmFlowDirective {
  readonly store = inject(DbxLlmFlowStore);
  readonly storageAccessorFactory = inject(SimpleStorageAccessorFactory, { optional: true });

  private readonly _destroyRef = inject(DestroyRef);

  readonly dbxLlmFlow = input<Maybe<DbxLlmFlowConfig | ''>>();

  /**
   * The storage key. Overrides the config's persistence storage key. Switching keys saves the old key, resets the flow, then restores the new key.
   */
  readonly storageKey = input<Maybe<string>>();

  readonly configSignal = computed(() => this.dbxLlmFlow() || undefined);
  readonly effectiveStorageKeySignal = computed(() => {
    const config = this.configSignal();
    return this.storageKey() ?? config?.persistence?.storageKey;
  });

  private readonly _storageKey$ = toObservable(this.effectiveStorageKeySignal);
  private _storageSync: Maybe<DbxLlmFlowStorageSync>;

  constructor() {
    effect(() => {
      const config = this.configSignal();

      untracked(() => {
        this.store.setFlowConfig(config);

        if (this._storageSync == null && this.storageAccessorFactory != null) {
          const accessor = this.storageAccessorFactory.createStorageAccessor<DbxLlmFlowPersistedState>({ prefix: DBX_LLM_FLOW_STORAGE_PREFIX });
          const storageSync = new DbxLlmFlowStorageSync({ store: this.store, accessor, storageKey$: this._storageKey$, debounceTime: config?.persistence?.debounceTime });
          this._destroyRef.onDestroy(() => storageSync.destroy()); // the effect body is not an injection context, so clean() can not be used here
          this._storageSync = storageSync;
          storageSync.init();
        }
      });
    });
  }

  get storageSync(): Maybe<DbxLlmFlowStorageSync> {
    return this._storageSync;
  }
}

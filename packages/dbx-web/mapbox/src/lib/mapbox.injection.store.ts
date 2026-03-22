import { map, type Observable, shareReplay } from 'rxjs';
import { Injectable } from '@angular/core';
import { type DbxInjectionComponentConfigWithoutInjector } from '@dereekb/dbx-core';
import { ComponentStore } from '@ngrx/component-store';
import { distinctUntilMapHasDifferentKeys, type ObservableOrValueGetter } from '@dereekb/rxjs';

export type DbxMapboxInjectionKey = string;

export interface DbxMapboxInjectionConfig {
  /**
   * Unique key that identifies this config specifically.
   *
   * Keys should all be unique. The system does not expect duplicate keys. Modifications to injectionConfig should occur through the observable value.
   */
  readonly key: DbxMapboxInjectionKey;
  /**
   * Arbitrary injection type. Is used for filtering on configurations.
   */
  readonly type?: string;
  /**
   * Injection configuration. The injector is disallowed, as the parent injector must include the mapbox component.
   */
  readonly injectionConfig: ObservableOrValueGetter<DbxInjectionComponentConfigWithoutInjector>;
}

export interface DbxMapboxMapInjectionStoreState {
  /**
   * Current map of injection keys and configurations.
   */
  readonly map: Map<DbxMapboxInjectionKey, DbxMapboxInjectionConfig>;

  // TODO: Add filters for showing/hiding elements of different types.
}

/**
 * Store used for storing injectable content into the map.
 */
@Injectable()
export class DbxMapboxInjectionStore extends ComponentStore<DbxMapboxMapInjectionStoreState> {
  constructor() {
    super({
      map: new Map<DbxMapboxInjectionKey, DbxMapboxInjectionConfig>()
    });
  }

  readonly map$: Observable<Map<DbxMapboxInjectionKey, DbxMapboxInjectionConfig>> = this.state$.pipe(
    map((x) => x.map),
    distinctUntilMapHasDifferentKeys(),
    shareReplay(1)
  );

  readonly allInjectionConfigs$: Observable<DbxMapboxInjectionConfig[]> = this.map$.pipe(
    map((x) => Array.from(x.values())),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly addInjectionConfig = this.updater(updateDbxMapboxMapInjectionStoreStateWithInjectionConfig);
  readonly removeInjectionConfigWithKey = this.updater(updateDbxMapboxMapInjectionStoreStateWithRemovedKey);
}

/**
 * Returns an updated store state with the given injection config added or replaced in the map, keyed by its unique key.
 *
 * @param state - The current mapbox injection store state.
 * @param config - The injection configuration to add or update.
 * @returns The updated store state containing the new or replaced config.
 */
export function updateDbxMapboxMapInjectionStoreStateWithInjectionConfig(state: DbxMapboxMapInjectionStoreState, config: DbxMapboxInjectionConfig) {
  const map = new Map(state.map).set(config.key, config);
  return { ...state, map };
}

/**
 * Returns an updated store state with the injection config for the given key removed. If the key does not exist, returns the state unchanged.
 *
 * @param state - The current mapbox injection store state.
 * @param key - The injection key to remove from the map.
 * @returns The updated store state with the key removed, or the original state if the key was not present.
 */
export function updateDbxMapboxMapInjectionStoreStateWithRemovedKey(state: DbxMapboxMapInjectionStoreState, key: DbxMapboxInjectionKey) {
  // only create a new state if the key is going to get removed
  if (state.map.has(key)) {
    const map = new Map(state.map);
    map.delete(key);
    state = { ...state, map };
  }

  return state;
}

import { InjectionToken } from '@angular/core';

/**
 * DI token for the application's default {@link FullStorageObject} instance.
 *
 * Provided by {@link provideDbxStorage}.
 */
export const DEFAULT_STORAGE_OBJECT_TOKEN = new InjectionToken('DBX_CORE_DEFAULT_STORAGE_OBJECT');

/**
 * DI token for the application's default {@link SimpleStorageAccessorFactory} instance.
 *
 * Provided by {@link provideDbxStorage}.
 */
export const DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN = new InjectionToken('DBX_CORE_DEFAULT_STORAGE_ACCESSOR_FACTORY');

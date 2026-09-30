import type { InjectionKey, Ref } from 'vue';
import type { CheckService } from './data/checks';
import type { Row } from './data/storageBackend';

/** The signed-in user, shared with every page so they update on sign-in and sign-out. */
export const sessionKey: InjectionKey<Ref<Row | undefined>> = Symbol('session');

/** Whether the demo data is still loading the first time, or failed to load; pages show this (T39). */
export interface DemoDataState {
  loading: boolean;
  error: string;
}

export const demoDataKey: InjectionKey<DemoDataState> = Symbol('demoData');

/** Orders vendor checks for coordinator screens without handing them the system data layer (T43). */
export const checkServiceKey: InjectionKey<CheckService> = Symbol('checkService');

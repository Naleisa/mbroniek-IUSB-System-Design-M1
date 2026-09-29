import type { InjectionKey, Ref } from 'vue';
import type { Row } from './data/storageBackend';

/** The signed-in user, shared with every page so they update on sign-in and sign-out. */
export const sessionKey: InjectionKey<Ref<Row | undefined>> = Symbol('session');

/**
 * @typedef {import('./interface').TestStore} TestStore
 */
/**
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
export function murmurHasher(key: Uint8Array): Uint8Array;
/**
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
export function identityHasher(key: Uint8Array): Uint8Array;
/**
 * @returns {TestStore}
 */
export function memoryStore(): TestStore;
/**
 * @param {Uint8Array} d
 * @returns {string}
 */
export function toHex(d: Uint8Array): string;
/**
 * @param {string|Uint8Array} hex
 * @returns {Uint8Array}
 */
export function fromHex(hex: string | Uint8Array): Uint8Array;
export type TestStore = import('./interface').TestStore;
//# sourceMappingURL=common.d.ts.map
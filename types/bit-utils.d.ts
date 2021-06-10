/**
 * @param {Uint8Array} hash
 * @param {number} depth
 * @param {number} nbits
 * @returns {number}
 */
export function mask(hash: Uint8Array, depth: number, nbits: number): number;
/**
 * set the `position` bit in the given `bitmap` to be `set` (truthy=1, falsey=0)
 * @param {Uint8Array} bitmap
 * @param {number} position
 * @param {boolean} set
 * @returns {Uint8Array}
 */
export function setBit(bitmap: Uint8Array, position: number, set: boolean): Uint8Array;
/**
 * check whether `bitmap` has a `1` at the given `position` bit
 * @param {Uint8Array} bitmap
 * @param {number} [position]
 * @param {number} [byte]
 * @param {number} [offset]
 * @returns {boolean}
 */
export function bitmapHas(bitmap: Uint8Array, position?: number | undefined, byte?: number | undefined, offset?: number | undefined): boolean;
/**
 * count how many `1` bits are in `bitmap up until `position`
 * tells us where in the compacted element array an element should live
 * TODO: optimize with a popcount on a `position` shifted bitmap?
 * assumes bitmapHas(bitmap, position) == true, hence the i<position and +1 in the return
 * @param {Uint8Array} bitmap
 * @param {number} position
 * @returns {number}
 */
export function index(bitmap: Uint8Array, position: number): number;
//# sourceMappingURL=bit-utils.d.ts.map
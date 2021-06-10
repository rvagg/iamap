// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const bitSequence = require('bit-sequence')

/**
 * @param {Uint8Array} hash
 * @param {number} depth
 * @param {number} nbits
 * @returns {number}
 */
function mask (hash, depth, nbits) {
  return bitSequence(hash, depth * nbits, nbits)
}

/**
 * set the `position` bit in the given `bitmap` to be `set` (truthy=1, falsey=0)
 * @param {Uint8Array} bitmap
 * @param {number} position
 * @param {boolean} set
 * @returns {Uint8Array}
 */
function setBit (bitmap, position, set) {
  // if we assume that `bitmap` is already the opposite of `set`, we could skip this check
  const byte = Math.floor(position / 8)
  const offset = position % 8
  const has = bitmapHas(bitmap, undefined, byte, offset)
  if ((set && !has) || (!set && has)) {
    const newBitmap = Uint8Array.from(bitmap)
    let b = bitmap[byte]
    if (set) {
      b |= (1 << offset)
    } else {
      b ^= (1 << offset)
    }
    newBitmap[byte] = b
    return newBitmap
  }
  return bitmap
}

/**
 * check whether `bitmap` has a `1` at the given `position` bit
 * @param {Uint8Array} bitmap
 * @param {number} [position]
 * @param {number} [byte]
 * @param {number} [offset]
 * @returns {boolean}
 */
function bitmapHas (bitmap, position, byte, offset) {
  if (typeof byte !== 'number' || typeof offset !== 'number') {
    if (position === undefined) {
      throw new Error('`position` expected')
    }
    byte = Math.floor(position / 8)
    offset = position % 8
  }
  return ((bitmap[byte] >> offset) & 1) === 1
}

/**
 * count how many `1` bits are in `bitmap up until `position`
 * tells us where in the compacted element array an element should live
 * TODO: optimize with a popcount on a `position` shifted bitmap?
 * assumes bitmapHas(bitmap, position) == true, hence the i<position and +1 in the return
 * @param {Uint8Array} bitmap
 * @param {number} position
 * @returns {number}
 */
function index (bitmap, position) {
  let t = 0
  for (let i = 0; i < position; i++) {
    if (bitmapHas(bitmap, i)) {
      t++
    }
  }
  return t
}

module.exports.mask = mask
module.exports.setBit = setBit
module.exports.bitmapHas = bitmapHas
module.exports.index = index

// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const assert = require('assert')

// mask off `nbits` bits at `depth` position of `hash` where `hash` is a UInt8Array-like
function mask (hash, depth, nbits) {
  assert(Array.isArray(hash) || Buffer.isBuffer(hash))
  let index = Math.floor((depth * nbits) / 8)
  let shift = (depth * nbits) % 8
  let lowBits = Math.min(nbits, 8 - shift)
  let hiBits = nbits - lowBits
  return ((hash[index] >> shift) & ((1 << lowBits) - 1)) |
    ((hash[index + 1] & ((1 << hiBits) - 1)) << lowBits)
}

// set the `position` bit in the given `bitmap` to be `set` (truthy=1, falsey=0)
function setBit (bitmap, position, set) {
  // if we assume that `bitmap` is already the opposite of `set`, we could skip this check
  let has = bitmapHas(bitmap, position)
  if ((set && !has) || (!set && has)) {
    return set ? bitmap | (1 << position) : bitmap ^ (1 << position)
  }
  return bitmap
}

// check whether `bitmap` has a `1` at the given `position` bit
function bitmapHas (bitmap, position) {
  return (bitmap >> position) & 1
}

// count how many `1` bits are in `bitmap up until `position`
// tells us where in the compacted element array an element should live
// TODO: optimize with a popcount on a `position` shifted bitmap?
// assumes bitmapHas(bitmap, position) == true, hence the i<position and +1 in the return
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

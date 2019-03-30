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

if (require.main === module) {
  assert.strictEqual(mask([0b11111111], 0, 5), 0b11111)
  assert.strictEqual(mask([0b10101010], 0, 5), 0b1010)
  assert.strictEqual(mask([0b00000001], 0, 5), 0b1)
  assert.strictEqual(mask([0b00010000], 0, 5), 0b10000)
  assert.strictEqual(mask([0b1001000010000100], 0, 9), 0b010000100)
  assert.strictEqual(mask([0b1010101010101010], 0, 9), 0b010101010)

  assert(!bitmapHas(0b0, 0))
  assert(!bitmapHas(0b0, 1))
  assert(bitmapHas(0b1, 0))
  assert(!bitmapHas(0b1, 1))
  assert(!bitmapHas(0b101010, 2))
  assert(bitmapHas(0b101010, 3))
  assert(!bitmapHas(0b101010, 4))
  assert(bitmapHas(0b101010, 5))
  assert(bitmapHas(0b100000, 5))
  assert(bitmapHas(0b0100000, 5))
  assert(bitmapHas(0b00100000, 5))

  assert.strictEqual(index(0b111111, 0), 0)
  assert.strictEqual(index(0b111111, 1), 1)
  assert.strictEqual(index(0b111111, 2), 2)
  assert.strictEqual(index(0b111111, 4), 4)
  assert.strictEqual(index(0b111100, 2), 0)
  assert.strictEqual(index(0b111101, 4), 3)
  assert.strictEqual(index(0b111001, 4), 2)
  assert.strictEqual(index(0b111000, 4), 1)
  assert.strictEqual(index(0b110000, 4), 0)
  // new node, no bitmask, insertion at the start
  assert.strictEqual(index(0b000000, 0), 0)
  assert.strictEqual(index(0b000000, 1), 0)
  assert.strictEqual(index(0b000000, 2), 0)
  assert.strictEqual(index(0b000000, 3), 0)

  assert.strictEqual(setBit(0b0, 0, 1), 0b00000001)
  assert.strictEqual(setBit(0b0, 1, 1), 0b00000010)
  assert.strictEqual(setBit(0b0, 7, 1), 0b10000000)
  assert.strictEqual(setBit(0b11111111, 0, 1), 0b11111111)
  assert.strictEqual(setBit(0b11111111, 7, 1), 0b11111111)
  assert.strictEqual(setBit(0b01010101, 1, 1), 0b01010111)
  assert.strictEqual(setBit(0b01010101, 7, 1), 0b11010101)
  assert.strictEqual(setBit(0b11111111, 0, 0), 0b11111110)
  assert.strictEqual(setBit(0b11111111, 1, 0), 0b11111101)
  assert.strictEqual(setBit(0b11111111, 7, 0), 0b01111111)
  assert.strictEqual(setBit(0b0, 0, 0), 0b00000000)
  assert.strictEqual(setBit(0b0, 7, 0), 0b00000000)
  assert.strictEqual(setBit(0b01010101, 0, 0), 0b01010100)
  assert.strictEqual(setBit(0b01010101, 6, 0), 0b00010101)
  assert.strictEqual(setBit(0b1100001011010010010010100000001, 0, 0), 0b1100001011010010010010100000000)
  assert.strictEqual(setBit(0b1100001011010010010010100000000, 0, 1), 0b1100001011010010010010100000001)
  assert.strictEqual(setBit(0b0, 31, 1), -0b10000000000000000000000000000000)
}

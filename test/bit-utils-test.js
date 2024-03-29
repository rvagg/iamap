// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

import { assert } from 'chai'
import { toHex } from './common.js'
import { mask, bitmapHas, index, setBit } from '../bit-utils.js'

describe('Bit utils', () => {
  it('mask', () => {
    assert.strictEqual(mask(Uint8Array.from([0b11111111]), 0, 5), 0b11111)
    assert.strictEqual(mask(Uint8Array.from([0b10101010]), 0, 5), 0b10101)
    assert.strictEqual(mask(Uint8Array.from([0b10000000]), 0, 5), 0b10000)
    assert.strictEqual(mask(Uint8Array.from([0b00010000]), 0, 5), 0b00010)
    assert.strictEqual(mask(Uint8Array.from([0b10000100, 0b10010000]), 0, 9), 0b100001001)
    assert.strictEqual(mask(Uint8Array.from([0b10101010, 0b10101010]), 0, 9), 0b101010101)
    assert.strictEqual(mask(Uint8Array.from([0b10000100, 0b10010000]), 1, 5), 0b10010)
    assert.strictEqual(mask(Uint8Array.from([0b10101010, 0b10101010]), 1, 5), 0b01010)
    assert.strictEqual(mask(Uint8Array.from([0b10000100, 0b10010000]), 2, 5), 0b01000)
    assert.strictEqual(mask(Uint8Array.from([0b10101010, 0b10101010]), 2, 5), 0b10101)
    assert.strictEqual(mask(Uint8Array.from([0b10000100, 0b10010000, 0b10000100, 0b10000100]), 3, 5), 0b01000)
    assert.strictEqual(mask(Uint8Array.from([0b10101010, 0b10101010, 0b10101010, 0b10101010]), 3, 5), 0b01010)
    assert.strictEqual(mask(Uint8Array.from([0b10000100, 0b10010000, 0b10000100, 0b10000100]), 4, 5), 0b01001)
    assert.strictEqual(mask(Uint8Array.from([0b10101010, 0b10101010, 0b10101010, 0b10101010]), 4, 5), 0b10101)
  })

  it('bitmapHas', () => {
    assert.ok(!bitmapHas(Uint8Array.from([0b0]), 0))
    assert.ok(!bitmapHas(Uint8Array.from([0b0]), 1))
    assert.ok(bitmapHas(Uint8Array.from([0b1]), 0))
    assert.ok(!bitmapHas(Uint8Array.from([0b1]), 1))
    assert.ok(!bitmapHas(Uint8Array.from([0b101010]), 2))
    assert.ok(bitmapHas(Uint8Array.from([0b101010]), 3))
    assert.ok(!bitmapHas(Uint8Array.from([0b101010]), 4))
    assert.ok(bitmapHas(Uint8Array.from([0b101010]), 5))
    assert.ok(bitmapHas(Uint8Array.from([0b100000]), 5))
    assert.ok(bitmapHas(Uint8Array.from([0b0100000]), 5))
    assert.ok(bitmapHas(Uint8Array.from([0b00100000]), 5))
  })

  it('index', () => {
    assert.strictEqual(index(Uint8Array.from([0b111111]), 0), 0)
    assert.strictEqual(index(Uint8Array.from([0b111111]), 1), 1)
    assert.strictEqual(index(Uint8Array.from([0b111111]), 2), 2)
    assert.strictEqual(index(Uint8Array.from([0b111111]), 4), 4)
    assert.strictEqual(index(Uint8Array.from([0b111100]), 2), 0)
    assert.strictEqual(index(Uint8Array.from([0b111101]), 4), 3)
    assert.strictEqual(index(Uint8Array.from([0b111001]), 4), 2)
    assert.strictEqual(index(Uint8Array.from([0b111000]), 4), 1)
    assert.strictEqual(index(Uint8Array.from([0b110000]), 4), 0)
    // new node, no bitmask, insertion at the start
    assert.strictEqual(index(Uint8Array.from([0b000000]), 0), 0)
    assert.strictEqual(index(Uint8Array.from([0b000000]), 1), 0)
    assert.strictEqual(index(Uint8Array.from([0b000000]), 2), 0)
    assert.strictEqual(index(Uint8Array.from([0b000000]), 3), 0)
  })

  it('setBit', () => {
    assert.strictEqual(toHex(setBit(Uint8Array.from([0]), 0, 1)), toHex(Uint8Array.from([0b00000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0]), 1, 1)), toHex(Uint8Array.from([0b00000010])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0]), 7, 1)), toHex(Uint8Array.from([0b10000000])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11111111]), 0, 1)), toHex(Uint8Array.from([0b11111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11111111]), 7, 1)), toHex(Uint8Array.from([0b11111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b01010101]), 1, 1)), toHex(Uint8Array.from([0b01010111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b01010101]), 7, 1)), toHex(Uint8Array.from([0b11010101])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11111111]), 0, 0)), toHex(Uint8Array.from([0b11111110])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11111111]), 1, 0)), toHex(Uint8Array.from([0b11111101])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11111111]), 7, 0)), toHex(Uint8Array.from([0b01111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b11111111]), 8 + 0, 1)), toHex(Uint8Array.from([0, 0b11111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b11111111]), 8 + 7, 1)), toHex(Uint8Array.from([0, 0b11111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b01010101]), 8 + 1, 1)), toHex(Uint8Array.from([0, 0b01010111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b01010101]), 8 + 7, 1)), toHex(Uint8Array.from([0, 0b11010101])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b11111111]), 8 + 0, 0)), toHex(Uint8Array.from([0, 0b11111110])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b11111111]), 8 + 1, 0)), toHex(Uint8Array.from([0, 0b11111101])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0b11111111]), 8 + 7, 0)), toHex(Uint8Array.from([0, 0b01111111])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0]), 0, 0)), toHex(Uint8Array.from([0b00000000])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0]), 7, 0)), toHex(Uint8Array.from([0b00000000])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b01010101]), 0, 0)), toHex(Uint8Array.from([0b01010100])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b01010101]), 6, 0)), toHex(Uint8Array.from([0b00010101])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 0, 0)), toHex(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 0, 1)), toHex(Uint8Array.from([0b11000011, 0b11010010, 0b01001010, 0b0000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 12, 0)), toHex(Uint8Array.from([0b11000010, 0b11000010, 0b01001010, 0b0000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 12, 1)), toHex(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 24, 0)), toHex(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000000])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001]), 24, 1)), toHex(Uint8Array.from([0b11000010, 0b11010010, 0b01001010, 0b0000001])))
    assert.strictEqual(toHex(setBit(Uint8Array.from([0, 0, 0, 0]), 31, 1)), toHex(Uint8Array.from([0, 0, 0, -0b10000000])))
  })
})

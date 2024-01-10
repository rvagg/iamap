// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

import * as chai from 'chai'
import chaiAsPromised from '@rvagg/chai-as-promised'
import * as iamap from '../iamap.js'
import { identityHasher } from './common.js'

/**
 * @typedef {import('../interface').Store<number>} Store
 */

chai.use(chaiAsPromised)
const { assert } = chai

iamap.registerHasher(0x00 /* 'identity' */, 32, identityHasher) // not recommended

// absolutely not recommended
/** @type {Store} */
const devnull = {
  async save (_) {
    return 0
  },
  async load (_) {
    throw new Error('unimplemented')
  },
  isEqual () {
    return true
  },
  isLink (_) {
    return true
  }
}

describe('Errors', () => {
  it('registerHasher errors', () => {
    // @ts-ignore
    assert.throws(() => { iamap.registerHasher('herp', 32, () => {}) })
    // @ts-ignore
    assert.throws(() => { iamap.registerHasher('herp', 'derp', 32, () => {}) })
    // @ts-ignore
    assert.throws(() => { iamap.registerHasher(0x00, 'derp', () => {}) })
    // @ts-ignore
    assert.throws(() => { iamap.registerHasher(0x00, 32) })
  })

  it('constructor errors', async () => {
    // @ts-ignore
    await assert.isRejected(iamap.create({ herp: 'derp' }, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 3 }))
    // @ts-ignore
    await assert.isRejected(iamap.create(devnull))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */ }))
    // @ts-ignore
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'herp' }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0xff /* '??' */, bitWidth: 3 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: -1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 0 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 2 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 3 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 8 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 16 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 17 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: -1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 0 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 1 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 2 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 16 }))
    // @ts-ignore
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 4, bucketSize: 16 }, 'blerk'))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 10, bucketSize: 16 }, new Uint8Array(2)))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 0x00 /* 'identity' */, bitWidth: 10, bucketSize: 16 }, new Uint8Array((2 ** 10) / 8)))
  })
})

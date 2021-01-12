// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const iamap = require('../')
const { identityHasher } = require('./common')

chai.use(chaiAsPromised)
const { assert } = chai

iamap.registerHasher('identity', 32, identityHasher) // not recommended

// absolutely not recommended
const devnull = {
  save (obj) {
    return 0
  },
  load (id) {
    throw new Error('unimplemented')
  },
  isEqual (id1, id2) {
    return true
  },
  isLink (id) {
    return true
  }
}

describe('Errors', () => {
  it('registerHasher errors', () => {
    assert.throws(() => { iamap.registerHasher('herp', 32, () => {}) })
    assert.throws(() => { iamap.registerHasher('identity', 'derp', () => {}) })
    assert.throws(() => { iamap.registerHasher('identity', 32) })
  })

  it('constructor errors', async () => {
    await assert.isRejected(iamap.create({ herp: 'derp' }, { hashAlg: 'identity', bitWidth: 4, bucketSize: 3 }))
    await assert.isRejected(iamap.create(devnull))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity' }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'herp' }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: -1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 0 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 2 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 3 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 8 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 16 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 17 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: -1 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 0 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 1 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 16 }))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 16 }, 'blerk'))
    await assert.isRejected(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 10, bucketSize: 16 }, Buffer.alloc(2)))
    await assert.isFulfilled(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 10, bucketSize: 16 }, Buffer.alloc((2 ** 10) / 8)))
  })
})

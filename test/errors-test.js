// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const IAMap = require('../')
const { identityHasher } = require('./common')

IAMap.registerHasher('identity', 32, identityHasher) // not recommended

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
  }
}

test('registerHasher errors', (t) => {
  t.throws(() => { IAMap.registerHasher('herp', 32, () => {}) })
  t.throws(() => { IAMap.registerHasher('identity', 'derp', () => {}) })
  t.throws(() => { IAMap.registerHasher('identity', 32) })
  t.done()
})

test('constructor errors', (t) => {
  t.rejects(IAMap.create({ herp: 'derp' }, { hashAlg: 'identity', bitWidth: 4, bucketSize: 3 }))
  t.rejects(IAMap.create(devnull))
  t.resolves(IAMap.create(devnull, { hashAlg: 'identity' }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'herp' }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: -1 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 0 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
  t.resolves(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 2 }))
  t.resolves(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 8 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 9 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: -1 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 0 }))
  t.rejects(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 1 }))
  t.resolves(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }))
  t.resolves(IAMap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 16 }))
  t.done()
})

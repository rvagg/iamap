// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const iamap = require('../')
const { identityHasher } = require('./common')

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
  }
}

test('registerHasher errors', (t) => {
  t.throws(() => { iamap.registerHasher('herp', 32, () => {}) })
  t.throws(() => { iamap.registerHasher('identity', 'derp', () => {}) })
  t.throws(() => { iamap.registerHasher('identity', 32) })
  t.done()
})

test('constructor errors', (t) => {
  t.rejects(iamap.create({ herp: 'derp' }, { hashAlg: 'identity', bitWidth: 4, bucketSize: 3 }))
  t.rejects(iamap.create(devnull))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity' }))
  t.rejects(iamap.create(devnull, { hashAlg: 'herp' }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: -1 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 0 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 1 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 2 }))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 3 }))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 8 }))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 16 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 17 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: -1 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 0 }))
  t.rejects(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 1 }))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }))
  t.resolves(iamap.create(devnull, { hashAlg: 'identity', bitWidth: 4, bucketSize: 16 }))
  t.done()
})

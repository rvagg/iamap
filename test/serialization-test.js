// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, identityHasher, memoryStore } = require('./common')
const iamap = require('../')

iamap.registerHasher('murmur3-32', 32, murmurHasher)
iamap.registerHasher('identity', 32, identityHasher) // not recommended

let Constructor

test('empty object', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  const emptySerialized = {
    hashAlg: 'murmur3-32',
    bitWidth: 5,
    bucketSize: 8,
    map: 0,
    data: []
  }

  t.strictDeepEqual(map.toSerializable(), emptySerialized)

  const loadedMap = await iamap.load(store, map.id)
  t.strictDeepEqual(loadedMap, map)

  Constructor = map.constructor
})

test('empty custom', async (t) => {
  const store = memoryStore()
  const emptySerialized = {
    hashAlg: 'identity', // identity
    bitWidth: 8,
    bucketSize: 3,
    map: 0,
    data: []
  }
  const id = await store.save(emptySerialized)

  const map = await iamap.load(store, id)
  t.strictDeepEqual(map.toSerializable(), emptySerialized)
  t.strictEqual(map.config.hashAlg, 'identity')
  t.strictEqual(map.config.bitWidth, 8)
  t.strictEqual(map.config.bucketSize, 3)
  t.strictEqual(map.map, 0)
  t.ok(Array.isArray(map.data))
  t.strictEqual(map.data.length, 0)
})

test('child custom', async (t) => {
  const store = memoryStore()
  const emptySerialized = {
    map: 0b110011,
    data: []
  }
  const id = await store.save(emptySerialized)

  const map = await iamap.load(store, id, 10, {
    hashAlg: 'identity',
    bitWidth: 7,
    bucketSize: 30
  })

  t.strictDeepEqual(map.toSerializable(), emptySerialized)
  t.strictEqual(map.depth, 10)
  t.strictEqual(map.config.hashAlg, 'identity')
  t.strictEqual(map.config.bitWidth, 7)
  t.strictEqual(map.config.bucketSize, 30)
  t.strictEqual(map.map, 0b110011)
  t.ok(Array.isArray(map.data))
  t.strictEqual(map.data.length, 0)
})

test('malformed', async (t) => {
  const store = memoryStore()
  let emptySerialized = {
    hashAlg: 'sha2-256', // not registered
    bitWidth: 8,
    bucketSize: 3,
    map: 0,
    data: []
  }
  let id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.hashAlg = 'identity' // identity
  emptySerialized.bitWidth = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bitWidth = -1
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bitWidth = 4
  emptySerialized.bucketSize = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bucketSize = -1
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bucketSize = 3
  emptySerialized.data = { nope: 'nope' }
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = []
  emptySerialized.map = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.map = 0
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id, 'foo'))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = [ { woot: 'nope' } ]
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = [ [ { nope: 'nope' } ] ]
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id))

  emptySerialized = {
    map: 0b110011,
    data: []
  }
  id = await store.save(emptySerialized)
  t.resolves(iamap.load(store, id, 32, {
    hashAlg: 'identity',
    bitWidth: 7,
    bucketSize: 30
  })) // this is OK for bitWidth of 8 and hash bytes of 32

  emptySerialized = Object.assign({}, emptySerialized) // clone
  id = await store.save(emptySerialized)
  t.rejects(iamap.load(store, id, 33, { // this is not OK for a bitWidth of 8 and hash bytes of 32
    hashAlg: 'identity',
    bitWidth: 8,
    bucketSize: 30
  }))

  t.throws(() => {
    iamap.fromSerializable(store, undefined, emptySerialized, {
      hashAlg: 'identity',
      bitWidth: 5,
      bucketSize: 2
    }, 'foobar')
  })

  t.throws(() => new Constructor(store, { hashAlg: 'identity' }, 0, 0, [ { nope: 'nope' } ]))
})

test('fromChildSerializable', async (t) => {
  const store = memoryStore()

  let emptySerializedRoot = {
    hashAlg: 'identity',
    bitWidth: 8,
    bucketSize: 3,
    map: 0,
    data: []
  }
  let emptySerializedChild = {
    map: 0b110011,
    data: []
  }

  t.strictEqual(iamap.isRootSerializable(emptySerializedRoot), true)
  t.strictEqual(iamap.isSerializable(emptySerializedRoot), true)
  t.strictEqual(iamap.isSerializable(emptySerializedChild), true)

  let root = await iamap.fromSerializable(store, 'somerootid', emptySerializedRoot)

  t.strictDeepEqual(root.toSerializable(), emptySerializedRoot)
  t.strictEqual(root.id, 'somerootid')

  let child = await root.fromChildSerializable('somechildid', emptySerializedChild, 10)

  t.strictDeepEqual(child.toSerializable(), emptySerializedChild)
  t.strictEqual(child.id, 'somechildid')
  t.strictEqual(child.config.hashAlg, 'identity')
  t.strictEqual(child.config.bitWidth, 8)
  t.strictEqual(child.config.bucketSize, 3)
  t.strictEqual(child.map, 0b110011)
  t.ok(Array.isArray(child.data))
  t.strictEqual(child.data.length, 0)

  child = await root.fromChildSerializable(undefined, emptySerializedChild, 10)

  t.strictDeepEqual(child.toSerializable(), emptySerializedChild)
  t.strictEqual(child.id, null)
})

test('bad loads', async (t) => {
  const store = memoryStore()

  let emptySerialized = {
    map: 0b110011,
    data: []
  }
  let id = await store.save(emptySerialized)

  t.rejects(iamap.load(store, id, 32, {
    bitWidth: 8,
    bucketSize: 30
  })) // no hashAlg

  t.rejects(iamap.load(store, id, 32, {
    hashAlg: { yoiks: true },
    bitWidth: 8,
    bucketSize: 30
  })) // bad hashAlg

  t.rejects(iamap.load(store, id, 32, {
    hashAlg: 'identity',
    bitWidth: 'foo',
    bucketSize: 30
  })) // bad bitWidth

  t.rejects(iamap.load(store, id, 32, {
    hashAlg: 'identity',
    bitWidth: 8,
    bucketSize: true
  })) // bad bucketSize

  t.rejects(iamap.load(store, id, 'foo', {
    hashAlg: 'identity',
    bitWidth: 8,
    bucketSize: 8
  })) // bad bucketSize
})

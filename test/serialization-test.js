// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, identityHasher, memoryStore } = require('./common')
const IAMap = require('../')

IAMap.registerHasher('murmur3-32', 32, murmurHasher)
IAMap.registerHasher('identity', 32, identityHasher) // not recommended

let Constructor

test('empty object', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const emptySerialized = {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  }

  t.strictDeepEqual(map.toSerializable(), emptySerialized)

  const loadedMap = await IAMap.load(store, map.id)
  t.strictDeepEqual(loadedMap, map)

  Constructor = map.constructor
})

test('empty custom', async (t) => {
  const store = memoryStore()
  const emptySerialized = {
    codec: Buffer.from([ 0 ]), // identity
    bitWidth: 8,
    bucketSize: 3,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  }
  const id = await store.save(emptySerialized)

  const map = await IAMap.load(store, id)
  t.strictDeepEqual(map.toSerializable(), emptySerialized)
  t.strictEqual(map.config.codec, 'identity')
  t.strictEqual(map.config.bitWidth, 8)
  t.strictEqual(map.config.bucketSize, 3)
  t.strictEqual(map.dataMap, 0)
  t.strictEqual(map.nodeMap, 0)
  t.ok(Array.isArray(map.elements))
  t.strictEqual(map.elements.length, 0)
})

test('malformed', async (t) => {
  const store = memoryStore()
  let emptySerialized = {
    codec: Buffer.from([ 10 ]), // not registered
    bitWidth: 8,
    bucketSize: 3,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  }
  let id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.codec = Buffer.from([ 0 ]) // identity
  emptySerialized.bitWidth = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bitWidth = -1
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bitWidth = 4
  emptySerialized.bucketSize = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bucketSize = -1
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.bucketSize = 3
  emptySerialized.elements = { nope: 'nope' }
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.elements = []
  emptySerialized.nodeMap = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.nodeMap = 0
  emptySerialized.dataMap = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.dataMap = 0
  emptySerialized.depth = 'foo'
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.depth = 0
  emptySerialized.elements = [ { woot: 'nope' } ]
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.depth = 0
  emptySerialized.elements = [ [ { nope: 'nope' } ] ]
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.elements = []
  emptySerialized.bitWidth = 8
  emptySerialized.depth = 32 // this is OK for bitWidth of 8 and hash bytes of 32
  id = await store.save(emptySerialized)
  t.resolves(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.depth = 33 // this is not OK for a bitWidth of 8 and hash bytes of 32
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  t.throws(() => new Constructor(store, { codec: 'identity' }, 0, 0, 0, [ { nope: 'nope' } ]))
})

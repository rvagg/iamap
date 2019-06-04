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
    codec: 'murmur3-32',
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    data: []
  }

  t.strictDeepEqual(map.toSerializable(), emptySerialized)

  const loadedMap = await IAMap.load(store, map.id)
  t.strictDeepEqual(loadedMap, map)

  Constructor = map.constructor
})

test('empty custom', async (t) => {
  const store = memoryStore()
  const emptySerialized = {
    codec: 'identity', // identity
    bitWidth: 8,
    bucketSize: 3,
    dataMap: 0,
    nodeMap: 0,
    data: []
  }
  const id = await store.save(emptySerialized)

  const map = await IAMap.load(store, id)
  t.strictDeepEqual(map.toSerializable(), emptySerialized)
  t.strictEqual(map.config.codec, 'identity')
  t.strictEqual(map.config.bitWidth, 8)
  t.strictEqual(map.config.bucketSize, 3)
  t.strictEqual(map.dataMap, 0)
  t.strictEqual(map.nodeMap, 0)
  t.ok(Array.isArray(map.data))
  t.strictEqual(map.data.length, 0)
})

test('child custom', async (t) => {
  const store = memoryStore()
  const emptySerialized = {
    dataMap: 0b110011,
    nodeMap: 0b101010,
    data: []
  }
  const id = await store.save(emptySerialized)

  const map = await IAMap.load(store, id, 10, {
    codec: 'identity',
    bitWidth: 7,
    bucketSize: 30
  })

  t.strictDeepEqual(map.toSerializable(), emptySerialized)
  t.strictEqual(map.depth, 10)
  t.strictEqual(map.config.codec, 'identity')
  t.strictEqual(map.config.bitWidth, 7)
  t.strictEqual(map.config.bucketSize, 30)
  t.strictEqual(map.dataMap, 0b110011)
  t.strictEqual(map.nodeMap, 0b101010)
  t.ok(Array.isArray(map.data))
  t.strictEqual(map.data.length, 0)
})

test('malformed', async (t) => {
  const store = memoryStore()
  let emptySerialized = {
    codec: 'sha2-256', // not registered
    bitWidth: 8,
    bucketSize: 3,
    dataMap: 0,
    nodeMap: 0,
    data: []
  }
  let id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.codec = 'identity' // identity
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
  emptySerialized.data = { nope: 'nope' }
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = []
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
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id, 'foo'))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = [ { woot: 'nope' } ]
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = Object.assign({}, emptySerialized) // clone
  emptySerialized.data = [ [ { nope: 'nope' } ] ]
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id))

  emptySerialized = {
    dataMap: 0b110011,
    nodeMap: 0b101010,
    data: []
  }
  id = await store.save(emptySerialized)
  t.resolves(IAMap.load(store, id, 32, {
    codec: 'identity',
    bitWidth: 7,
    bucketSize: 30
  })) // this is OK for bitWidth of 8 and hash bytes of 32

  emptySerialized = Object.assign({}, emptySerialized) // clone
  id = await store.save(emptySerialized)
  t.rejects(IAMap.load(store, id, 33, { // this is not OK for a bitWidth of 8 and hash bytes of 32
    codec: 'identity',
    bitWidth: 8,
    bucketSize: 30
  }))

  t.throws(() => {
    IAMap.fromSerializable(store, undefined, emptySerialized, {
      codec: 'identity',
      bitWidth: 5,
      bucketSize: 2
    }, 'foobar')
  })

  t.throws(() => new Constructor(store, { codec: 'identity' }, 0, 0, 0, [ { nope: 'nope' } ]))
})

test('fromChildSerializable', async (t) => {
  const store = memoryStore()

  let emptySerializedRoot = {
    codec: 'identity',
    bitWidth: 8,
    bucketSize: 3,
    dataMap: 0,
    nodeMap: 0,
    data: []
  }
  let emptySerializedChild = {
    dataMap: 0b110011,
    nodeMap: 0b101010,
    data: []
  }

  t.strictEqual(IAMap.isRootSerializable(emptySerializedRoot), true)
  t.strictEqual(IAMap.isSerializable(emptySerializedRoot), true)
  t.strictEqual(IAMap.isSerializable(emptySerializedChild), true)

  let root = await IAMap.fromSerializable(store, 'somerootid', emptySerializedRoot)

  t.strictDeepEqual(root.toSerializable(), emptySerializedRoot)
  t.strictEqual(root.id, 'somerootid')

  let child = await root.fromChildSerializable('somechildid', emptySerializedChild, 10)

  t.strictDeepEqual(child.toSerializable(), emptySerializedChild)
  t.strictEqual(child.id, 'somechildid')
  t.strictEqual(child.config.codec, 'identity')
  t.strictEqual(child.config.bitWidth, 8)
  t.strictEqual(child.config.bucketSize, 3)
  t.strictEqual(child.dataMap, 0b110011)
  t.strictEqual(child.nodeMap, 0b101010)
  t.ok(Array.isArray(child.data))
  t.strictEqual(child.data.length, 0)

  child = await root.fromChildSerializable(undefined, emptySerializedChild, 10)

  t.strictDeepEqual(child.toSerializable(), emptySerializedChild)
  t.strictEqual(child.id, null)
})

test('bad loads', async (t) => {
  const store = memoryStore()

  let emptySerialized = {
    dataMap: 0b110011,
    nodeMap: 0b101010,
    data: []
  }
  let id = await store.save(emptySerialized)

  t.rejects(IAMap.load(store, id, 32, {
    bitWidth: 8,
    bucketSize: 30
  })) // no codec

  t.rejects(IAMap.load(store, id, 32, {
    codec: { yoiks: true },
    bitWidth: 8,
    bucketSize: 30
  })) // bad codec

  t.rejects(IAMap.load(store, id, 32, {
    codec: 'identity',
    bitWidth: 'foo',
    bucketSize: 30
  })) // bad bitWidth

  t.rejects(IAMap.load(store, id, 32, {
    codec: 'identity',
    bitWidth: 8,
    bucketSize: true
  })) // bad bucketSize

  t.rejects(IAMap.load(store, id, 'foo', {
    codec: 'identity',
    bitWidth: 8,
    bucketSize: 8
  })) // bad bucketSize
})

// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, memoryStore } = require('./common')
const IAMap = require('../')

IAMap.registerHasher('murmur3-32', 32, murmurHasher)

const PEAK = 100 // not huge but delete is super expensive

const store = memoryStore() // same store across tests
let loadId
let keys = []

test(`fill with ${PEAK}`, async (t) => {
  let map = await IAMap.create(store, { hashAlg: 'murmur3-32' })
  let expectedValues = []
  let expectedEntries = []

  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 5,
    bucketSize: 8,
    map: 0,
    data: []
  })
  t.strictEqual(store.map.size, 1)
  t.strictEqual(store.saves, 1)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.isInvariant(), true)
  map = await map.set('foo', 'bar')
  map = await map.set('bar', 'baz')
  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.get('foo'), 'bar')
  t.strictEqual(await map.get('bar'), 'baz')
  t.strictEqual(await map.get('boom'), null)

  map = await map.set('bar', 'baz') // repeat
  t.strictEqual(await map.get('bar'), 'baz')
  map = await map.set('bar', 'booz') // replace
  t.strictEqual(await map.get('bar'), 'booz')
  t.strictEqual(await map.isInvariant(), true)

  for (let i = 0; i < PEAK; i++) {
    let key = `k${i}`
    let value = `v${i}`
    map = await map.set(key, value)
    keys.push(key)
    expectedValues.push(value)
    expectedEntries.push(JSON.stringify({ key, value }))
  }
  for (let i = PEAK - 1; i >= 0; i--) {
    t.strictEqual(await map.get(`k${i}`), `v${i}`)
    t.strictEqual(await map.has(`k${i}`), true)
  }

  let actualKeys = []
  for await (let k of map.keys()) {
    actualKeys.push(k.toString())
  }
  let actualValues = []
  for await (let v of map.values()) {
    actualValues.push(v.toString())
  }
  let actualEntries = []
  for await (let e of map.entries()) {
    actualEntries.push(JSON.stringify({ key: e.key.toString(), value: e.value }))
  }

  keys.sort()
  expectedValues.sort()
  expectedEntries.sort()
  actualKeys.sort()
  actualValues.sort()
  actualEntries.sort()
  t.deepEqual(actualKeys, [ 'bar', 'foo' ].concat(keys))
  t.deepEqual(actualValues, [ 'bar', 'booz' ].concat(expectedValues))
  t.deepEqual(actualEntries, [ '{"key":"bar","value":"booz"}', '{"key":"foo","value":"bar"}' ].concat(expectedEntries))

  loadId = map.id
})

test(`load ${PEAK} node map and empty it`, async (t) => {
  let map = await IAMap.load(store, loadId)

  t.strictEqual(await map.get('foo'), 'bar')
  t.strictEqual(await map.get('bar'), 'booz')
  for (let i = 0; i < PEAK; i++) {
    t.strictEqual(await map.get(`k${i}`), `v${i}`)
  }
  t.strictEqual(await map.isInvariant(), true)

  t.strictEqual(await map.delete('whoop'), map) // nothing to delete

  t.strictEqual(await map.get('foo'), 'bar')
  t.strictEqual(await map.get('bar'), 'booz')
  map = await map.delete('foo')
  t.strictEqual(await map.get('foo'), null)
  t.strictEqual(await map.get('bar'), 'booz')
  map = await map.delete('bar')
  t.ok(!await map.get('bar'))

  let shuffledKeys = keys.slice().sort(() => 0.5 - Math.random()) // randomish
  for (let i = 0; i < shuffledKeys.length; i++) {
    let key = shuffledKeys[i]
    map = await map.delete(key)
    t.strictEqual(await map.get(key), null)
    for (let j = i + 1; j < shuffledKeys.length; j++) { // make sure the rest are still there
      let key = shuffledKeys[j]
      let value = key.replace(/^k/, 'v')
      t.strictEqual(await map.get(key), value)
    }
  }
})

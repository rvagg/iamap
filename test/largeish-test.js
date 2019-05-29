// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, memoryStore } = require('./common')
const IAMap = require('../')

IAMap.registerHasher('murmur3-32', 32, murmurHasher)

const PEAK = 100 // not huge but delete is super expensive

const store = memoryStore() // same store across tests
let loadId
let keys = []

test(`fill with ${PEAK} and empty`, async (t) => {
  let map = await IAMap.create(store, { codec: 'murmur3-32' })

  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    elements: []
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
    map = await map.set(`k${i}`, `v${i}`)
    keys.push(`k${i}`)
  }
  for (let i = PEAK - 1; i >= 0; i--) {
    t.strictEqual(await map.get(`k${i}`), `v${i}`)
    t.strictEqual(await map.has(`k${i}`), true)
  }

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

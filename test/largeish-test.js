// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

const { assert } = require('chai')
const { murmurHasher, memoryStore } = require('./common')
const iamap = require('../')

iamap.registerHasher('murmur3-32', 32, murmurHasher)

const PEAK = 100 // not huge but delete is super expensive

const store = memoryStore() // same store across tests
let loadId
const keys = []

describe('Large(ish)', () => {
  it(`fill with ${PEAK}`, async () => {
    let map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    const expectedValues = []
    const expectedEntries = []

    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc((2 ** 8) / 8),
      data: []
    })
    assert.strictEqual(store.map.size, 1)
    assert.strictEqual(store.saves, 1)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.isInvariant(), true)
    map = await map.set('foo', 'bar')
    map = await map.set('bar', 'baz')
    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await map.get('foo'), 'bar')
    assert.strictEqual(await map.get('bar'), 'baz')
    assert.strictEqual(await map.get('boom'), undefined)

    map = await map.set('bar', 'baz') // repeat
    assert.strictEqual(await map.get('bar'), 'baz')
    map = await map.set('bar', 'booz') // replace
    assert.strictEqual(await map.get('bar'), 'booz')
    assert.strictEqual(await map.isInvariant(), true)

    for (let i = 0; i < PEAK; i++) {
      const key = `k${i}`
      const value = `v${i}`
      map = await map.set(key, value)
      keys.push(key)
      expectedValues.push(value)
      expectedEntries.push(JSON.stringify({ key, value }))
    }
    for (let i = PEAK - 1; i >= 0; i--) {
      assert.strictEqual(await map.get(`k${i}`), `v${i}`)
      assert.strictEqual(await map.has(`k${i}`), true)
    }

    const actualKeys = []
    for await (const k of map.keys()) {
      actualKeys.push(k.toString())
    }
    const actualValues = []
    for await (const v of map.values()) {
      actualValues.push(v.toString())
    }
    const actualEntries = []
    for await (const e of map.entries()) {
      actualEntries.push(JSON.stringify({ key: e.key.toString(), value: e.value }))
    }

    keys.sort()
    expectedValues.sort()
    expectedEntries.sort()
    actualKeys.sort()
    actualValues.sort()
    actualEntries.sort()
    assert.deepEqual(actualKeys, ['bar', 'foo'].concat(keys))
    assert.deepEqual(actualValues, ['bar', 'booz'].concat(expectedValues))
    assert.deepEqual(actualEntries, ['{"key":"bar","value":"booz"}', '{"key":"foo","value":"bar"}'].concat(expectedEntries))

    loadId = map.id
  })

  it(`load ${PEAK} node map and empty it`, async () => {
    let map = await iamap.load(store, loadId)

    assert.strictEqual(await map.get('foo'), 'bar')
    assert.strictEqual(await map.get('bar'), 'booz')
    for (let i = 0; i < PEAK; i++) {
      assert.strictEqual(await map.get(`k${i}`), `v${i}`)
    }
    assert.strictEqual(await map.isInvariant(), true)

    assert.strictEqual(await map.delete('whoop'), map) // nothing to delete

    assert.strictEqual(await map.get('foo'), 'bar')
    assert.strictEqual(await map.get('bar'), 'booz')
    map = await map.delete('foo')
    assert.strictEqual(await map.get('foo'), undefined)
    assert.strictEqual(await map.get('bar'), 'booz')
    map = await map.delete('bar')
    assert.ok(!await map.get('bar'))

    const shuffledKeys = keys.slice().sort(() => 0.5 - Math.random()) // randomish
    for (let i = 0; i < shuffledKeys.length; i++) {
      const key = shuffledKeys[i]
      map = await map.delete(key)
      assert.strictEqual(await map.get(key), undefined)
      for (let j = i + 1; j < shuffledKeys.length; j++) { // make sure the rest are still there
        const key = shuffledKeys[j]
        const value = key.replace(/^k/, 'v')
        assert.strictEqual(await map.get(key), value)
      }
    }
  })
})

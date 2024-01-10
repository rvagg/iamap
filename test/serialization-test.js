// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

import * as chai from 'chai'
import chaiAsPromised from '@rvagg/chai-as-promised'
import { murmurHasher, identityHasher, memoryStore, toHex } from './common.js'
import * as iamap from '../iamap.js'

chai.use(chaiAsPromised)
const { assert } = chai

/**
 * @typedef {import('../iamap.js').SerializedRoot} SerializedRoot
 * @typedef {import('../iamap.js').SerializedNode} SerializedNode
 */

iamap.registerHasher(0x23 /* 'murmur3-32' */, 32, murmurHasher)
iamap.registerHasher(0x00 /* 'identity' */, 32, identityHasher) // not recommended

/** @type {iamap.IAMap<number>} */
let Constructor

describe('Serialization', () => {
  it('empty object', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 0x23 /* 'murmur3-32' */ })
    /** @type {SerializedRoot} */
    const emptySerialized = {
      hashAlg: 0x23 /* 'murmur3-32' */,
      bucketSize: 5,
      hamt: [new Uint8Array((2 ** 8) / 8), []]
    }

    assert.deepEqual(map.toSerializable(), emptySerialized)

    const loadedMap = await iamap.load(store, map.id)
    assert.deepEqual(loadedMap, map)

    // @ts-ignore
    Constructor = map.constructor
  })

  it('empty custom', async () => {
    const store = memoryStore()
    /** @type {SerializedRoot} */
    const emptySerialized = {
      hashAlg: 0x00 /* 'identity' */, // identity
      bucketSize: 3,
      hamt: [new Uint8Array(2 ** 8 / 8), []]
    }
    const id = await store.save(emptySerialized)

    const map = await iamap.load(store, id)
    assert.deepEqual(map.toSerializable(), emptySerialized)
    assert.strictEqual(map.config.hashAlg, 0x00 /* 'identity' */)
    assert.strictEqual(map.config.bitWidth, 8)
    assert.strictEqual(map.config.bucketSize, 3)
    assert.strictEqual(toHex(map.map), toHex(new Uint8Array(2 ** 8 / 8)))
    assert.ok(Array.isArray(map.data))
    assert.strictEqual(map.data.length, 0)
  })

  it('child custom', async () => {
    const store = memoryStore()
    const dmap = new Uint8Array(2 ** 7 / 8)
    dmap[5] = 0b110011
    /** @type {SerializedNode} */
    const emptySerialized = [dmap, []]
    const id = await store.save(emptySerialized)

    const map = await iamap.load(store, id, 10, {
      hashAlg: 0x00 /* 'identity' */,
      bitWidth: 7,
      bucketSize: 30
    })

    assert.deepEqual(map.toSerializable(), emptySerialized)
    assert.strictEqual(map.depth, 10)
    assert.strictEqual(map.config.hashAlg, 0x00 /* 'identity' */)
    assert.strictEqual(map.config.bitWidth, 7)
    assert.strictEqual(map.config.bucketSize, 30)
    assert.strictEqual(toHex(map.map), toHex(dmap))
    assert.ok(Array.isArray(map.data))
    assert.strictEqual(map.data.length, 0)
  })

  it('malformed', async () => {
    const store = memoryStore()
    const emptyMap = new Uint8Array(2 ** 8 / 8)
    /** @type {SerializedRoot} */
    let emptySerialized = {
      hashAlg: 0x12 /* 'sha2-256' */, // not registered
      bucketSize: 3,
      hamt: [emptyMap, []]
    }
    let id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    emptySerialized.hashAlg = 0x00 /* 'identity' */
    // @ts-ignore
    emptySerialized.bucketSize = 'foo'
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    emptySerialized.bucketSize = -1
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    // @ts-ignore
    emptySerialized = Object.assign({}, emptySerialized) // clone
    emptySerialized.bucketSize = 3
    // @ts-ignore
    emptySerialized.hamt[1] = { nope: 'nope' }
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    emptySerialized.hamt[1] = []
    // @ts-ignore
    emptySerialized.hamt[0] = 'foo'
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    // @ts-ignore
    emptySerialized.hamt[0] = emptyMap
    // @ts-ignore
    id = await store.save(emptySerialized)
    // @ts-ignore
    await assert.isRejected(iamap.load(store, id, 'foo'))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    // @ts-ignore
    emptySerialized.hamt[1] = [{ woot: 'nope' }]
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    emptySerialized = Object.assign({}, emptySerialized) // clone
    // @ts-ignore
    emptySerialized.hamt[1] = [[{ nope: 'nope' }]]
    // @ts-ignore
    id = await store.save(emptySerialized)
    await assert.isRejected(iamap.load(store, id))

    const mapCopy = Uint8Array.from(emptyMap)
    mapCopy[0] = 0b110011
    /** @type {SerializedNode} */
    let emptyChildSerialized = [mapCopy, []]
    id = await store.save(emptyChildSerialized)
    assert.isFulfilled(iamap.load(store, id, 32, {
      hashAlg: 0x00 /* 'identity' */,
      bitWidth: 8,
      bucketSize: 30
    })) // this is OK for bitWidth of 8 and hash bytes of 32

    emptyChildSerialized = /** @type {SerializedNode} */ (emptyChildSerialized.slice()) // clone
    id = await store.save(emptyChildSerialized)
    await assert.isRejected(iamap.load(store, id, 33, { // this is not OK for a bitWidth of 8 and hash bytes of 32
      hashAlg: 0x00 /* 'identity' */,
      bitWidth: 8,
      bucketSize: 30
    }))

    assert.throws(() => {
      iamap.fromSerializable(store, undefined, ['nope'], {
        hashAlg: 0x00 /* 'identity' */,
        bitWidth: 5,
        bucketSize: 2
        // @ts-ignore
      }, 'foobar')
    })

    assert.throws(() => {
      iamap.fromSerializable(store, undefined, emptyChildSerialized, {
        hashAlg: 0x00 /* 'identity' */,
        bitWidth: 5,
        bucketSize: 2
        // @ts-ignore
      }, 'foobar')
    })

    // @ts-ignore
    assert.throws(() => new Constructor(store, { hashAlg: 0x00 /* 'identity' */, bitWidth: 8 }, new Uint8Array(2 ** 8 / 8), 0, [{ nope: 'nope' }]))
  })

  it('fromChildSerializable', async () => {
    const store = memoryStore()

    /** @type {SerializedRoot} */
    const emptySerializedRoot = {
      hashAlg: 0x00 /* 'identity' */,
      bucketSize: 3,
      hamt: [new Uint8Array(2 ** 8 / 8), []]
    }
    const childMap = new Uint8Array(2 ** 8 / 8)
    childMap[4] = 0b110011
    /** @type {SerializedNode} */
    const emptySerializedChild = [childMap, []]

    assert.strictEqual(iamap.isRootSerializable(emptySerializedRoot), true)
    assert.strictEqual(iamap.isSerializable(emptySerializedRoot), true)
    assert.strictEqual(iamap.isSerializable(emptySerializedChild), true)

    const root = await iamap.fromSerializable(store, 'somerootid', emptySerializedRoot)

    assert.deepEqual(root.toSerializable(), emptySerializedRoot)
    assert.strictEqual(root.id, 'somerootid')

    let child = await root.fromChildSerializable('somechildid', emptySerializedChild, 10)

    assert.deepEqual(child.toSerializable(), emptySerializedChild)
    assert.strictEqual(child.id, 'somechildid')
    assert.strictEqual(child.config.hashAlg, 0x00 /* 'identity' */)
    assert.strictEqual(child.config.bitWidth, 8)
    assert.strictEqual(child.config.bucketSize, 3)
    assert.strictEqual(toHex(child.map), toHex(childMap))
    assert.ok(Array.isArray(child.data))
    assert.strictEqual(child.data.length, 0)

    child = await root.fromChildSerializable(undefined, emptySerializedChild, 10)

    assert.deepEqual(child.toSerializable(), emptySerializedChild)
    assert.strictEqual(child.id, null)
  })

  it('bad loads', async () => {
    const store = memoryStore()
    const map = new Uint8Array(2 ** 8 / 8)
    map[4] = 0b110011

    const emptySerialized = [map, []]
    const id = await store.save(emptySerialized)

    // @ts-ignore
    await assert.isRejected(iamap.load(store, id, 32, {
      bitWidth: 8,
      bucketSize: 30
    })) // no hashAlg

    await assert.isRejected(iamap.load(store, id, 32, {
      // @ts-ignore
      hashAlg: { yoiks: true },
      bitWidth: 8,
      bucketSize: 30
    })) // bad hashAlg

    await assert.isRejected(iamap.load(store, id, 32, {
      hashAlg: 0x00 /* 'identity' */,
      // @ts-ignore
      bitWidth: 'foo',
      bucketSize: 30
    })) // bad bitWidth

    await assert.isRejected(iamap.load(store, id, 32, {
      hashAlg: 0x00 /* 'identity' */,
      bitWidth: 8,
      // @ts-ignore
      bucketSize: true
    })) // bad bucketSize

    // @ts-ignore
    await assert.isRejected(iamap.load(store, id, 'foo', {
      hashAlg: 0x00 /* 'identity' */,
      bitWidth: 8,
      bucketSize: 8
    })) // bad bucketSize
  })
})

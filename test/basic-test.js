// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

/* eslint-env mocha */

const { assert } = require('chai')
const { murmurHasher, identityHasher, memoryStore } = require('./common')
const iamap = require('../')

iamap.registerHasher('murmur3-32', 32, murmurHasher)
iamap.registerHasher('identity', 32, identityHasher) // not recommended

describe('Basics', () => {
  it('empty object', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc(32), // 2**8, bitWidth of 8
      data: []
    })
    assert.strictEqual(store.map.size, 1)
    assert.strictEqual(store.saves, 1)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.size(), 0)
    assert.strictEqual(await map.isInvariant(), true)
  })

  it('test basic set/get', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    const newMap = await map.set('foo', 'bar')

    assert.strictEqual(await newMap.get('foo'), 'bar')
    assert.strictEqual(await map.get('foo'), undefined)
    assert.strictEqual(await newMap.has('foo'), true)
    assert.strictEqual(await map.has('nope'), false)
    assert.strictEqual(await map.has('foo'), false)

    // original map isn't mutated
    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc(32),
      data: []
    })
    assert.deepEqual(newMap.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.from(newMap.map),
      data: [[[Buffer.from('foo'), 'bar']]]
    })
    assert.ok(newMap.map !== 0)
    assert.strictEqual(store.map.size, 2)
    assert.strictEqual(store.saves, 2)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.size(), 0)
    assert.strictEqual(await newMap.size(), 1)
    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await newMap.isInvariant(), true)
  })

  it('test basic set/set-same/get', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    const newMap1 = await map.set('foo', 'bar')
    const newMap2 = await newMap1.set('foo', 'bar')

    assert.strictEqual(await newMap1.get('foo'), 'bar')
    assert.strictEqual(await map.get('foo'), undefined)
    assert.strictEqual(newMap1, newMap2) // identity match, should be the same object

    // original map isn't mutated
    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc(32),
      data: []
    })
    assert.deepEqual(newMap1.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.from(newMap1.map),
      data: [[[Buffer.from('foo'), 'bar']]]
    })
    assert.ok(newMap1.map !== 0)
    assert.strictEqual(store.map.size, 2)
    assert.strictEqual(store.saves, 2)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.size(), 0)
    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await newMap1.size(), 1)
    assert.strictEqual(await newMap1.isInvariant(), true)
    assert.strictEqual(await newMap2.size(), 1)
    assert.strictEqual(await newMap2.isInvariant(), true)
  })

  it('test basic set/update/get', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    const newMap1 = await map.set('foo', 'bar')
    const newMap2 = await newMap1.set('foo', 'baz')

    assert.strictEqual(await newMap1.get('foo'), 'bar')
    assert.strictEqual(await newMap2.get('foo'), 'baz')
    assert.strictEqual(await map.get('foo'), undefined)
    assert.notStrictEqual(newMap1, newMap2) // identity not match

    // original map isn't mutated
    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc(32),
      data: []
    })
    assert.deepEqual(newMap1.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.from(newMap1.map),
      data: [[[Buffer.from('foo'), 'bar']]]
    })
    assert.ok(newMap1.map !== 0)
    assert.deepEqual(newMap2.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.from(newMap1.map),
      data: [[[Buffer.from('foo'), 'baz']]]
    })
    assert.ok(newMap2.map !== 0)
    assert.strictEqual(store.map.size, 3)
    assert.strictEqual(store.saves, 3)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.size(), 0)
    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await newMap1.size(), 1)
    assert.strictEqual(await newMap1.isInvariant(), true)
    assert.strictEqual(await newMap2.size(), 1)
    assert.strictEqual(await newMap2.isInvariant(), true)
  })

  it('test basic set/get/delete', async () => {
    const store = memoryStore()
    const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
    const setMap = await map.set('foo', 'bar')
    const deleteMap = await setMap.delete('foo')

    assert.strictEqual(await deleteMap.get('foo'), undefined)
    assert.strictEqual(await setMap.get('foo'), 'bar')
    assert.strictEqual(await map.get('foo'), undefined)
    assert.strictEqual(await setMap.delete('nope'), setMap) // identity match, same map returned

    // original map isn't mutated
    assert.deepEqual(map.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.alloc(32),
      data: []
    })
    assert.deepEqual(setMap.toSerializable(), {
      hashAlg: 'murmur3-32',
      bucketSize: 5,
      map: Buffer.from(setMap.map),
      data: [[[Buffer.from('foo'), 'bar']]]
    })
    // should be back to square one
    assert.deepEqual(deleteMap.toSerializable(), map.toSerializable())
    // 3 saves but only 2 entries because deleteMap is a duplicate of map
    assert.strictEqual(store.map.size, 2)
    assert.strictEqual(store.saves, 3)
    assert.strictEqual(store.loads, 0)

    assert.strictEqual(await map.size(), 0)
    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await setMap.size(), 1)
    assert.strictEqual(await setMap.isInvariant(), true)
    assert.strictEqual(await deleteMap.size(), 0)
    assert.strictEqual(await deleteMap.isInvariant(), true)
  })

  /*
  * NOTE ABOUT IDENTITY HASH TESTS
  * With identity hashes we can control the index at each level but we have to construct the
  * key carefully. If we choose a bitWidth of 4, that's 2 halves of an 8 bit number, so we
  * can put together 2 depth indexes by shifting the first one to the left by 4 bits and adding
  * the second to it. So `5 << 4 | 2` sets up a 2 indexes, 5 and 2, represented in 4 bits each.
  */

  it('test predictable single level fill', async () => {
    const store = memoryStore()
    let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 3 })
    // bitWidth of 4 yields 16 buckets, we can use 'identity' hash to feed keys that we know
    // will go into certain slots
    for (let i = 0; i < 16; i++) {
      map = await map.set(Buffer.from([i << 4, 0]), `value0x${i}`)
    }

    for (let i = 0; i < 16; i++) {
      assert.strictEqual(await map.get(Buffer.from([i << 4, 0])), `value0x${i}`)
    }

    // inspect internals
    assert.strictEqual(map.data.length, 16)
    map.data.forEach((e, i) => {
      assert.strictEqual(e.link, null)
      assert.ok(Array.isArray(e.bucket))
      assert.strictEqual(e.bucket.length, 1)
      assert.strictEqual(e.bucket[0].value, `value0x${i}`)
    })

    // fill it right up
    for (let i = 0; i < 16; i++) {
      map = await map.set(Buffer.from([i << 4, 1]), `value1x${i}`)
      map = await map.set(Buffer.from([i << 4, 2]), `value2x${i}`)
    }

    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 3; j++) {
        assert.strictEqual(await map.get(Buffer.from([i << 4, j])), `value${j}x${i}`)
      }
    }

    // inspect internals, we should have 16 buckets with 3 entries each, filling up a single node with no children
    assert.strictEqual(map.data.length, 16)
    map.data.forEach((e, i) => {
      assert.strictEqual(e.link, null)
      assert.ok(Array.isArray(e.bucket))
      assert.strictEqual(e.bucket.length, 3)
      assert.strictEqual(e.bucket[0].value, `value0x${i}`)
      assert.strictEqual(e.bucket[1].value, `value1x${i}`)
      assert.strictEqual(e.bucket[2].value, `value2x${i}`)
    })
  })

  it('test predictable fill vertical and collapse', async () => {
    const store = memoryStore()
    const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }
    let map = await iamap.create(store, options)

    const k = (2 << 4) | 2
    // an 8-bit value with `2` in each of the 4-bit halves, for a `bitWidth` of 4 we are going to collide at
    // the position `2` of each level that we provide it

    map = await map.set(Buffer.from([k, k, k, 1 << 4]), 'pos2+1')
    map = await map.set(Buffer.from([k, k, k, 2 << 4]), 'pos2+2')

    // check that we have filled our first level, even though we asked for position 2, `data` is compressed so it still
    // only has one element
    async function validateBaseForm (map) {
      assert.strictEqual(await map.get(Buffer.from([k, k, k, 1 << 4])), 'pos2+1')
      assert.strictEqual(await map.get(Buffer.from([k, k, k, 2 << 4])), 'pos2+2')

      assert.strictEqual(map.map.toString('hex'), Buffer.from([0b100, 0]).toString('hex')) // data at position 2 but not 1 or 0
      assert.strictEqual(map.data.length, 1)
      assert.strictEqual(map.data[0].link, null)
      assert.ok(Array.isArray(map.data[0].bucket))
      assert.strictEqual(map.data[0].bucket.length, 2)
      assert.strictEqual(map.data[0].bucket[0].value, 'pos2+1')
      assert.strictEqual(map.data[0].bucket[1].value, 'pos2+2')

      assert.strictEqual(await map.isInvariant(), true)
      assert.strictEqual(await map.size(), 2)
    }
    await validateBaseForm(map)

    // the more we push in with `k` the more we collide and force creation of child nodes to contain them

    map = await map.set(Buffer.from([k, k, k, 3 << 4]), 'pos2+3')

    assert.strictEqual(map.map.toString('hex'), Buffer.from([0b100, 0]).toString('hex')) // position 2
    assert.strictEqual(map.data.length, 1)
    assert.strictEqual(map.data[0].bucket, null)
    assert.strictEqual(typeof map.data[0].link, 'number') // what's returned by store.save()

    let child = map
    // we can traverse down 5 more levels on the first, and only element
    // because of [k,k,k,k] - each k is 8 bytes so 2 levels of 4 bytes each
    // the 6th level should be where we find our data because we have non-colliding hash portions
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(child.map.toString('hex'), Buffer.from([0b100, 0]).toString('hex')) // position 2
      assert.strictEqual(child.data.length, 1)
      assert.strictEqual(child.data[0].bucket, null)
      assert.strictEqual(typeof child.data[0].link, 'number')
      child = await iamap.load(store, child.data[0].link, i + 1, options)
    }
    // at the 7th level they all have a different hash portion: 1,2,3 so they should be in separate buckets
    assert.strictEqual(child.data.length, 3)
    assert.strictEqual(child.map.toString('hex'), Buffer.from([0b1110, 0]).toString('hex')) // data at positions 1,2,3, but not 0
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(child.data[i].link, null)
      assert.ok(Array.isArray(child.data[i].bucket))
      assert.strictEqual(child.data[i].bucket.length, 1)
      assert.strictEqual(child.data[i].bucket[0].value, `pos2+${i + 1}`)
    }

    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await map.size(), 3)

    // while we have a deep tree, let's test a delete for a missing element at a known deep node
    assert.strictEqual(await map.delete(Buffer.from([k, k, k, 4 << 4])), map)

    // delete 'pos2+3' and we should be back where we started with just the two at the top level in the same bucket
    map = await map.delete(Buffer.from([k, k, k, 3 << 4]))
    await validateBaseForm(map)

    // put the awkward one back to re-create the 7-node depth
    map = await map.set(Buffer.from([k, k, k, 3 << 4]), 'pos2+3')
    // put one at level 5 so we don't collapse all the way
    map = await map.set(Buffer.from([k, k, 0, 0]), 'pos2+0+0')
    assert.strictEqual(await map.size(), 4)
    // delete awkward 3rd
    map = await map.delete(Buffer.from([k, k, k, 3 << 4]))

    assert.strictEqual(await map.get(Buffer.from([k, k, k, 1 << 4])), 'pos2+1')
    assert.strictEqual(await map.get(Buffer.from([k, k, k, 2 << 4])), 'pos2+2')
    assert.strictEqual(await map.get(Buffer.from([k, k, 0, 0])), 'pos2+0+0')

    assert.strictEqual(await map.size(), 3)

    child = map
    // 4 levels should be the same
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(child.map.toString('hex'), Buffer.from([0b100, 0]).toString('hex')) // position 2
      assert.strictEqual(child.data.length, 1)
      assert.strictEqual(child.data[0].bucket, null)
      assert.strictEqual(typeof child.data[0].link, 'number')
      child = await iamap.load(store, child.data[0].link, i + 1, options)
    }

    assert.strictEqual(child.map.toString('hex'), Buffer.from([0b101, 0]).toString('hex')) // data at position 2 and 0
    assert.strictEqual(child.data.length, 2)
    assert.strictEqual(child.data[0].link, null)
    assert.ok(Array.isArray(child.data[0].bucket))
    assert.strictEqual(child.data[0].bucket.length, 1)
    assert.strictEqual(child.data[0].bucket[0].value, 'pos2+0+0')
    assert.strictEqual(child.data[1].link, null)
    assert.ok(Array.isArray(child.data[1].bucket))
    assert.strictEqual(child.data[1].bucket.length, 2)
    assert.strictEqual(child.data[1].bucket[0].value, 'pos2+1')
    assert.strictEqual(child.data[1].bucket[1].value, 'pos2+2')

    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await map.size(), 3)
  })

  it('test predictable fill vertical, switched delete', async () => {
    const store = memoryStore()
    const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }
    let map = await iamap.create(store, options)
    const k = (2 << 4) | 2
    // 3 entries at the lowest node, one part way back up, like last test
    map = await map.set(Buffer.from([k, k, k, 1 << 4]), 'pos2+1')
    map = await map.set(Buffer.from([k, k, k, 2 << 4]), 'pos2+2')
    map = await map.set(Buffer.from([k, k, k, 3 << 4]), 'pos2+3')
    map = await map.set(Buffer.from([k, k, 0, 0]), 'pos2+0+0')

    // now delete one of the lowest to force a different tree form at the mid level
    map = await map.delete(Buffer.from([k, k, k, 2 << 4]))

    let child = map
    // 4 levels should be the same
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(child.map.toString('hex'), Buffer.from([0b100, 0]).toString('hex')) // position 2
      assert.strictEqual(child.data.length, 1)
      assert.strictEqual(child.data[0].bucket, null)
      assert.strictEqual(typeof child.data[0].link, 'number')
      child = await iamap.load(store, child.data[0].link, i + 1, options)
    }

    // last level should have 2 buckets but with a bucket in 0 and a node in 2
    assert.strictEqual(child.map.toString('hex'), Buffer.from([0b101, 0]).toString('hex')) // data at position 2 and 0
    assert.strictEqual(child.data.length, 2)
    assert.strictEqual(child.data[0].link, null)
    assert.ok(Array.isArray(child.data[0].bucket))
    assert.strictEqual(child.data[0].bucket.length, 1)
    assert.strictEqual(child.data[0].bucket[0].value, 'pos2+0+0')
    assert.strictEqual(child.data[1].link, null)
    assert.ok(Array.isArray(child.data[1].bucket))
    assert.strictEqual(child.data[1].bucket.length, 2)
    assert.strictEqual(child.data[1].bucket[0].value, 'pos2+1')
    assert.strictEqual(child.data[1].bucket[1].value, 'pos2+3')

    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await map.size(), 3)
  })

  it('test predictable fill vertical, larger buckets', async () => {
    const store = memoryStore()
    const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 4 }
    let map = await iamap.create(store, options)
    const k = (6 << 4) | 6 // let's try index 6 now

    // we're trying to trigger a compaction of a node which has a bucket of >1 entries, the first
    // 4 entries here form a bucket at the lowest node, the 5th is in its own bucket
    // removing one of the 4 should collapse that node up into the parent node, but no further
    // because there will be >4 thanks to the last 4 in this list
    map = await map.set(Buffer.from([k, (1 << 4) | 1, 0]), 'pos6+1+1')
    const pos612key = Buffer.from([k, (1 << 4) | 1, 1 << 4])
    map = await map.set(pos612key, 'pos6+1+2')
    map = await map.set(Buffer.from([k, (1 << 4) | 1, 2 << 4]), 'pos6+1+3')
    map = await map.set(Buffer.from([k, (1 << 4) | 1, 3 << 4]), 'pos6+1+4')
    map = await map.set(Buffer.from([k, (1 << 4) | 2, 5 << 4]), 'pos6+1+5')
    map = await map.set(Buffer.from([k, 2 << 4]), 'pos6+2')
    map = await map.set(Buffer.from([k, 3 << 4]), 'pos6+3')
    map = await map.set(Buffer.from([k, 4 << 4]), 'pos6+4')
    map = await map.set(Buffer.from([k, 5 << 4]), 'pos6+5')

    // now delete one of the lowest to force a different tree form at the mid level
    map = await map.delete(pos612key)

    let child = map
    // 4 levels should be the same
    for (let i = 0; i < 2; i++) {
      assert.strictEqual(child.map.toString('hex'), Buffer.from([0b1000000, 0]).toString('hex')) // position 6
      assert.strictEqual(child.data.length, 1)
      assert.strictEqual(child.data[0].bucket, null)
      assert.strictEqual(typeof child.data[0].link, 'number')
      child = await iamap.load(store, child.data[0].link, i + 1, options)
    }

    // last level should have 2 buckets but with a bucket in 0 and a node in 2
    assert.strictEqual(child.map.toString('hex'), Buffer.from([0b111110, 0]).toString('hex')) // data in postions 1-5
    assert.strictEqual(child.data.length, 5)
    assert.strictEqual(child.data[1].link, null)
    assert.ok(Array.isArray(child.data[1].bucket))
    assert.strictEqual(child.data[0].link, null)
    assert.strictEqual(child.data[1].link, null)
    assert.strictEqual(child.data[2].link, null)
    assert.strictEqual(child.data[3].link, null)
    assert.strictEqual(child.data[4].link, null)
    assert.ok(Array.isArray(child.data[0].bucket))
    assert.strictEqual(child.data[0].bucket.length, 4)
    assert.strictEqual(child.data[0].bucket[0].value, 'pos6+1+1')
    assert.strictEqual(child.data[0].bucket[1].value, 'pos6+1+3')
    assert.strictEqual(child.data[0].bucket[2].value, 'pos6+1+4')
    assert.strictEqual(child.data[0].bucket[3].value, 'pos6+1+5')
    assert.strictEqual(child.data[1].bucket[0].value, 'pos6+2')
    assert.strictEqual(child.data[2].bucket[0].value, 'pos6+3')
    assert.strictEqual(child.data[3].bucket[0].value, 'pos6+4')
    assert.strictEqual(child.data[4].bucket[0].value, 'pos6+5')

    assert.strictEqual(await map.isInvariant(), true)
    assert.strictEqual(await map.size(), 8)
  })

  it('test keys, values, entries', async () => {
    const store = memoryStore()
    // use the identity hash from the predictable fill test(s) to spread things out a bit
    let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
    const k = (2 << 4) | 2
    const ids = []
    map = await map.set(Buffer.from([k, k, k, 1 << 4]), 'pos2+1')
    ids.push(map.id)
    assert.strictEqual(await map.size(), 1)
    map = await map.set(Buffer.from([k, k, k, 2 << 4]), 'pos2+2')
    ids.push(map.id)
    assert.strictEqual(await map.size(), 2)
    map = await map.set(Buffer.from([k, k, k, 3 << 4]), 'pos2+3')
    ids.push(map.id)
    assert.strictEqual(await map.size(), 3)
    map = await map.set(Buffer.from([k, k, 0, 0]), 'pos2+0+0')
    ids.push(map.id)
    assert.strictEqual(await map.size(), 4)

    // you can't normally know the order but in this case it's predictable cause we control the hash
    const expectedKeys = ['22220000', '22222210', '22222220', '22222230']
    const expectedValues = ['pos2+0+0', 'pos2+1', 'pos2+2', 'pos2+3']
    const expectedEntries = expectedKeys.map((k, i) => { return { key: Buffer.from(k, 'hex'), value: expectedValues[i] } })

    let actual = []
    for await (const k of map.keys()) {
      actual.push(k.toString('hex'))
    }
    assert.deepEqual(actual, expectedKeys)

    actual = []
    for await (const v of map.values()) {
      actual.push(v)
    }
    assert.deepEqual(actual, expectedValues)

    actual = []
    for await (const e of map.entries()) {
      actual.push(e)
    }
    assert.deepEqual(actual, expectedEntries)

    let idCount = 0
    for await (const id of map.ids()) {
      // this is a bit lame but much easier than reverse engineering the hash of the stringified serialized form!
      assert.ok(store.map.has(id))
      idCount++
    }
    assert.strictEqual(idCount, 7) // 7 nodes deep
  })

  it('test non-store, sync block-by-block get traversal', async () => {
    const store = memoryStore()
    function isEqual (id1, id2) { return id1.equals(id2) }
    function isLink (link) { return typeof link === 'number' }
    let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
    const k = (2 << 4) | 2
    map = await map.set(Buffer.from([k, k, 1 << 4]), 'pos2+1')
    map = await map.set(Buffer.from([k, k, 2 << 4]), 'pos2+2')
    map = await map.set(Buffer.from([k, k, 3 << 4]), 'pos2+3')
    const deepKey = Buffer.from([k, k, 0])
    map = await map.set(deepKey, 'pos2+0+0')
    const rootBlock = store.load(map.id)

    let currentBlock = rootBlock
    const traversal = iamap.traverseGet(rootBlock, deepKey, isEqual, isLink)

    for (let i = 0; i < 4; i++) {
      const expectedChildId = currentBlock.data[0] // link
      assert.deepEqual(traversal.traverse(), expectedChildId)
      assert.strictEqual(traversal.value(), undefined)
      currentBlock = store.load(expectedChildId)
      traversal.next(currentBlock)
    }

    assert.deepEqual(traversal.traverse(), null)
    assert.strictEqual(traversal.value(), 'pos2+0+0')
  })

  it('test non-store, sync block-by-block keys traversal', async () => {
    const store = memoryStore()
    let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
    const k = (2 << 4) | 2
    map = await map.set(Buffer.from([k, k, 1 << 4]), 'pos2+1')
    map = await map.set(Buffer.from([k, k, 2 << 4]), 'pos2+2')
    map = await map.set(Buffer.from([k, k, 3 << 4]), 'pos2+3')
    map = await map.set(Buffer.from([k, k, 0]), 'pos2+0')
    const rootBlock = store.load(map.id)
    let currentBlock = rootBlock

    const traversal = iamap.traverseEntries(rootBlock)

    for (let i = 0; i < 4; i++) {
      assert.deepEqual([...traversal.keys()], [])
      assert.deepEqual([...traversal.values()], [])
      assert.deepEqual([...traversal.entries()], [])
      const id = traversal.traverse()
      assert.deepEqual(id, currentBlock.data[0]) // a link
      currentBlock = store.load(id)
      traversal.next(currentBlock)
    }

    assert.deepEqual(
      [...traversal.keys()],
      [Buffer.from([k, k, 0]), Buffer.from([k, k, 1 << 4]), Buffer.from([k, k, 2 << 4]), Buffer.from([k, k, 3 << 4])])
    assert.deepEqual(
      [...traversal.values()],
      ['pos2+0', 'pos2+1', 'pos2+2', 'pos2+3'])
    assert.deepEqual(
      [...traversal.entries()],
      [{ key: Buffer.from([k, k, 0]), value: 'pos2+0' },
        { key: Buffer.from([k, k, 1 << 4]), value: 'pos2+1' },
        { key: Buffer.from([k, k, 2 << 4]), value: 'pos2+2' },
        { key: Buffer.from([k, k, 3 << 4]), value: 'pos2+3' }])

    assert.deepEqual(traversal.traverse(), null)

    assert.deepEqual([...traversal.keys()], [])
    assert.deepEqual([...traversal.values()], [])
    assert.deepEqual([...traversal.entries()], [])
  })
})

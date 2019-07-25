// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, identityHasher, memoryStore } = require('./common')
const iamap = require('../')

iamap.registerHasher('murmur3-32', 32, murmurHasher)
iamap.registerHasher('identity', 32, identityHasher) // not recommended

test('empty object', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.alloc(32),
    data: []
  })
  t.strictEqual(store.map.size, 1)
  t.strictEqual(store.saves, 1)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await map.isInvariant(), true)
})

test('test basic set/get', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  const newMap = await map.set('foo', 'bar')

  t.strictEqual(await newMap.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), undefined)
  t.strictEqual(await newMap.has('foo'), true)
  t.strictEqual(await map.has('nope'), false)
  t.strictEqual(await map.has('foo'), false)

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.alloc(32),
    data: []
  })
  t.strictDeepEqual(newMap.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.from(newMap.map),
    data: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap.map !== 0)
  t.strictEqual(store.map.size, 2)
  t.strictEqual(store.saves, 2)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await newMap.size(), 1)
  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await newMap.isInvariant(), true)
})

test('test basic set/set-same/get', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  const newMap1 = await map.set('foo', 'bar')
  const newMap2 = await newMap1.set('foo', 'bar')

  t.strictEqual(await newMap1.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), undefined)
  t.strictEqual(newMap1, newMap2) // identity match, should be the same object

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.alloc(32),
    data: []
  })
  t.strictDeepEqual(newMap1.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.from(newMap1.map),
    data: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap1.map !== 0)
  t.strictEqual(store.map.size, 2)
  t.strictEqual(store.saves, 2)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await newMap1.size(), 1)
  t.strictEqual(await newMap1.isInvariant(), true)
  t.strictEqual(await newMap2.size(), 1)
  t.strictEqual(await newMap2.isInvariant(), true)
})

test('test basic set/update/get', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  const newMap1 = await map.set('foo', 'bar')
  const newMap2 = await newMap1.set('foo', 'baz')

  t.strictEqual(await newMap1.get('foo'), 'bar')
  t.strictEqual(await newMap2.get('foo'), 'baz')
  t.strictEqual(await map.get('foo'), undefined)
  t.notStrictEqual(newMap1, newMap2) // identity not match

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.alloc(32),
    data: []
  })
  t.strictDeepEqual(newMap1.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.from(newMap1.map),
    data: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap1.map !== 0)
  t.strictDeepEqual(newMap2.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.from(newMap1.map),
    data: [ [ [ Buffer.from('foo'), 'baz' ] ] ]
  })
  t.ok(newMap2.map !== 0)
  t.strictEqual(store.map.size, 3)
  t.strictEqual(store.saves, 3)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await newMap1.size(), 1)
  t.strictEqual(await newMap1.isInvariant(), true)
  t.strictEqual(await newMap2.size(), 1)
  t.strictEqual(await newMap2.isInvariant(), true)
})

test('test basic set/get/delete', async (t) => {
  const store = memoryStore()
  const map = await iamap.create(store, { hashAlg: 'murmur3-32' })
  const setMap = await map.set('foo', 'bar')
  const deleteMap = await setMap.delete('foo')

  t.strictEqual(await deleteMap.get('foo'), undefined)
  t.strictEqual(await setMap.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), undefined)
  t.strictEqual(await setMap.delete('nope'), setMap) // identity match, same map returned

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.alloc(32),
    data: []
  })
  t.strictDeepEqual(setMap.toSerializable(), {
    hashAlg: 'murmur3-32',
    bitWidth: 8,
    bucketSize: 5,
    map: Buffer.from(setMap.map),
    data: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  // should be back to square one
  t.strictDeepEqual(deleteMap.toSerializable(), map.toSerializable())
  // 3 saves but only 2 entries because deleteMap is a duplicate of map
  t.strictEqual(store.map.size, 2)
  t.strictEqual(store.saves, 3)
  t.strictEqual(store.loads, 0)

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await setMap.size(), 1)
  t.strictEqual(await setMap.isInvariant(), true)
  t.strictEqual(await deleteMap.size(), 0)
  t.strictEqual(await deleteMap.isInvariant(), true)
})

/*
 * NOTE ABOUT IDENTITY HASH TESTS
 * With identity hashes we can control the index at each level but we have to construct the
 * key carefully. If we choose a bitWidth of 4, that's 2 halves of an 8 bit number, so we
 * can put together 2 depth indexes by shifting the first one to the left by 4 bits and adding
 * the second to it. So `5 << 4 | 2` sets up a 2 indexes, 5 and 2, represented in 4 bits each.
 */

test('test predictable single level fill', async (t) => {
  const store = memoryStore()
  let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 3 })
  // bitWidth of 4 yields 16 buckets, we can use 'identity' hash to feed keys that we know
  // will go into certain slots
  for (let i = 0; i < 16; i++) {
    map = await map.set(Buffer.from([ i << 4, 0 ]), `value0x${i}`)
  }

  for (let i = 0; i < 16; i++) {
    t.strictEqual(await map.get(Buffer.from([ i << 4, 0 ])), `value0x${i}`)
  }

  // inspect internals
  t.strictEqual(map.data.length, 16)
  map.data.forEach((e, i) => {
    t.strictEqual(e.link, null)
    t.ok(Array.isArray(e.bucket))
    t.strictEqual(e.bucket.length, 1)
    t.strictEqual(e.bucket[0].value, `value0x${i}`)
  })

  // fill it right up
  for (let i = 0; i < 16; i++) {
    map = await map.set(Buffer.from([ i << 4, 1 ]), `value1x${i}`)
    map = await map.set(Buffer.from([ i << 4, 2 ]), `value2x${i}`)
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 3; j++) {
      t.strictEqual(await map.get(Buffer.from([ i << 4, j ])), `value${j}x${i}`)
    }
  }

  // inspect internals, we should have 16 buckets with 3 entries each, filling up a single node with no children
  t.strictEqual(map.data.length, 16)
  map.data.forEach((e, i) => {
    t.strictEqual(e.link, null)
    t.ok(Array.isArray(e.bucket))
    t.strictEqual(e.bucket.length, 3)
    t.strictEqual(e.bucket[0].value, `value0x${i}`)
    t.strictEqual(e.bucket[1].value, `value1x${i}`)
    t.strictEqual(e.bucket[2].value, `value2x${i}`)
  })
})

test('test predictable fill vertical and collapse', async (t) => {
  const store = memoryStore()
  const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }
  let map = await iamap.create(store, options)

  let k = (2 << 4) | 2
  // an 8-bit value with `2` in each of the 4-bit halves, for a `bitWidth` of 4 we are going to collide at
  // the position `2` of each level that we provide it

  map = await map.set(Buffer.from([ k, k, k, 1 << 4 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, k, 2 << 4 ]), 'pos2+2')

  // check that we have filled our first level, even though we asked for position 2, `data` is compressed so it still
  // only has one element
  async function validateBaseForm (map) {
    t.strictEqual(await map.get(Buffer.from([ k, k, k, 1 << 4 ])), 'pos2+1')
    t.strictEqual(await map.get(Buffer.from([ k, k, k, 2 << 4 ])), 'pos2+2')

    t.strictEqual(map.map.toString('hex'), Buffer.from([ 0b100, 0 ]).toString('hex')) // data at position 2 but not 1 or 0
    t.strictEqual(map.data.length, 1)
    t.strictEqual(map.data[0].link, null)
    t.ok(Array.isArray(map.data[0].bucket))
    t.strictEqual(map.data[0].bucket.length, 2)
    t.strictEqual(map.data[0].bucket[0].value, `pos2+1`)
    t.strictEqual(map.data[0].bucket[1].value, `pos2+2`)

    t.strictEqual(await map.isInvariant(), true)
    t.strictEqual(await map.size(), 2)
  }
  await validateBaseForm(map)

  // the more we push in with `k` the more we collide and force creation of child nodes to contain them

  map = await map.set(Buffer.from([ k, k, k, 3 << 4 ]), 'pos2+3')

  t.strictEqual(map.map.toString('hex'), Buffer.from([ 0b100, 0 ]).toString('hex')) // position 2
  t.strictEqual(map.data.length, 1)
  t.strictEqual(map.data[0].bucket, null)
  t.strictEqual(typeof map.data[0].link, 'number') // what's returned by store.save()

  let child = map
  // we can traverse down 5 more levels on the first, and only element
  // because of [k,k,k,k] - each k is 8 bytes so 2 levels of 4 bytes each
  // the 6th level should be where we find our data because we have non-colliding hash portions
  for (let i = 0; i < 6; i++) {
    t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b100, 0 ]).toString('hex')) // position 2
    t.strictEqual(child.data.length, 1)
    t.strictEqual(child.data[0].bucket, null)
    t.strictEqual(typeof child.data[0].link, 'number')
    child = await iamap.load(store, child.data[0].link, i + 1, options)
  }
  // at the 7th level they all have a different hash portion: 1,2,3 so they should be in separate buckets
  t.strictEqual(child.data.length, 3)
  t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b1110, 0 ]).toString('hex')) // data at positions 1,2,3, but not 0
  for (let i = 0; i < 3; i++) {
    t.strictEqual(child.data[i].link, null)
    t.ok(Array.isArray(child.data[i].bucket))
    t.strictEqual(child.data[i].bucket.length, 1)
    t.strictEqual(child.data[i].bucket[0].value, `pos2+${i + 1}`)
  }

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)

  // while we have a deep tree, let's test a delete for a missing element at a known deep node
  t.strictEqual(await map.delete(Buffer.from([ k, k, k, 4 << 4 ])), map)

  // delete 'pos2+3' and we should be back where we started with just the two at the top level in the same bucket
  map = await map.delete(Buffer.from([ k, k, k, 3 << 4 ]))
  await validateBaseForm(map)

  // put the awkward one back to re-create the 7-node depth
  map = await map.set(Buffer.from([ k, k, k, 3 << 4 ]), 'pos2+3')
  // put one at level 5 so we don't collapse all the way
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')
  t.strictEqual(await map.size(), 4)
  // delete awkward 3rd
  map = await map.delete(Buffer.from([ k, k, k, 3 << 4 ]))

  t.strictEqual(await map.get(Buffer.from([ k, k, k, 1 << 4 ])), 'pos2+1')
  t.strictEqual(await map.get(Buffer.from([ k, k, k, 2 << 4 ])), 'pos2+2')
  t.strictEqual(await map.get(Buffer.from([ k, k, 0, 0 ])), 'pos2+0+0')

  t.strictEqual(await map.size(), 3)

  child = map
  // 4 levels should be the same
  for (let i = 0; i < 4; i++) {
    t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b100, 0 ]).toString('hex')) // position 2
    t.strictEqual(child.data.length, 1)
    t.strictEqual(child.data[0].bucket, null)
    t.strictEqual(typeof child.data[0].link, 'number')
    child = await iamap.load(store, child.data[0].link, i + 1, options)
  }

  t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b101, 0 ]).toString('hex')) // data at position 2 and 0
  t.strictEqual(child.data.length, 2)
  t.strictEqual(child.data[0].link, null)
  t.ok(Array.isArray(child.data[0].bucket))
  t.strictEqual(child.data[0].bucket.length, 1)
  t.strictEqual(child.data[0].bucket[0].value, `pos2+0+0`)
  t.strictEqual(child.data[1].link, null)
  t.ok(Array.isArray(child.data[1].bucket))
  t.strictEqual(child.data[1].bucket.length, 2)
  t.strictEqual(child.data[1].bucket[0].value, `pos2+1`)
  t.strictEqual(child.data[1].bucket[1].value, `pos2+2`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)
})

test('test predictable fill vertical, switched delete', async (t) => {
  const store = memoryStore()
  const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 }
  let map = await iamap.create(store, options)
  let k = (2 << 4) | 2
  // 3 entries at the lowest node, one part way back up, like last test
  map = await map.set(Buffer.from([ k, k, k, 1 << 4 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, k, 2 << 4 ]), 'pos2+2')
  map = await map.set(Buffer.from([ k, k, k, 3 << 4 ]), 'pos2+3')
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')

  // now delete one of the lowest to force a different tree form at the mid level
  map = await map.delete(Buffer.from([ k, k, k, 2 << 4 ]))

  let child = map
  // 4 levels should be the same
  for (let i = 0; i < 4; i++) {
    t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b100, 0 ]).toString('hex')) // position 2
    t.strictEqual(child.data.length, 1)
    t.strictEqual(child.data[0].bucket, null)
    t.strictEqual(typeof child.data[0].link, 'number')
    child = await iamap.load(store, child.data[0].link, i + 1, options)
  }

  // last level should have 2 buckets but with a bucket in 0 and a node in 2
  t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b101, 0 ]).toString('hex')) // data at position 2 and 0
  t.strictEqual(child.data.length, 2)
  t.strictEqual(child.data[0].link, null)
  t.ok(Array.isArray(child.data[0].bucket))
  t.strictEqual(child.data[0].bucket.length, 1)
  t.strictEqual(child.data[0].bucket[0].value, `pos2+0+0`)
  t.strictEqual(child.data[1].link, null)
  t.ok(Array.isArray(child.data[1].bucket))
  t.strictEqual(child.data[1].bucket.length, 2)
  t.strictEqual(child.data[1].bucket[0].value, `pos2+1`)
  t.strictEqual(child.data[1].bucket[1].value, `pos2+3`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)
})

test('test predictable fill vertical, larger buckets', async (t) => {
  const store = memoryStore()
  const options = { hashAlg: 'identity', bitWidth: 4, bucketSize: 4 }
  let map = await iamap.create(store, options)
  let k = (6 << 4) | 6 // let's try index 6 now

  // we're trying to trigger a compaction of a node which has a bucket of >1 entries, the first
  // 4 entries here form a bucket at the lowest node, the 5th is in its own bucket
  // removing one of the 4 should collapse that node up into the parent node, but no further
  // because there will be >4 thanks to the last 4 in this list
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 0 ]), 'pos6+1+1')
  const pos612key = Buffer.from([ k, (1 << 4) | 1, 1 << 4 ])
  map = await map.set(pos612key, 'pos6+1+2')
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 2 << 4 ]), 'pos6+1+3')
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 3 << 4 ]), 'pos6+1+4')
  map = await map.set(Buffer.from([ k, (1 << 4) | 2, 5 << 4 ]), 'pos6+1+5')
  map = await map.set(Buffer.from([ k, 2 << 4 ]), 'pos6+2')
  map = await map.set(Buffer.from([ k, 3 << 4 ]), 'pos6+3')
  map = await map.set(Buffer.from([ k, 4 << 4 ]), 'pos6+4')
  map = await map.set(Buffer.from([ k, 5 << 4 ]), 'pos6+5')

  // now delete one of the lowest to force a different tree form at the mid level
  map = await map.delete(pos612key)

  let child = map
  // 4 levels should be the same
  for (let i = 0; i < 2; i++) {
    t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b1000000, 0 ]).toString('hex')) // position 6
    t.strictEqual(child.data.length, 1)
    t.strictEqual(child.data[0].bucket, null)
    t.strictEqual(typeof child.data[0].link, 'number')
    child = await iamap.load(store, child.data[0].link, i + 1, options)
  }

  // last level should have 2 buckets but with a bucket in 0 and a node in 2
  t.strictEqual(child.map.toString('hex'), Buffer.from([ 0b111110, 0 ]).toString('hex')) // data in postions 1-5
  t.strictEqual(child.data.length, 5)
  t.strictEqual(child.data[1].link, null)
  t.ok(Array.isArray(child.data[1].bucket))
  t.strictEqual(child.data[0].link, null)
  t.strictEqual(child.data[1].link, null)
  t.strictEqual(child.data[2].link, null)
  t.strictEqual(child.data[3].link, null)
  t.strictEqual(child.data[4].link, null)
  t.ok(Array.isArray(child.data[0].bucket))
  t.strictEqual(child.data[0].bucket.length, 4)
  t.strictEqual(child.data[0].bucket[0].value, `pos6+1+1`)
  t.strictEqual(child.data[0].bucket[1].value, `pos6+1+3`)
  t.strictEqual(child.data[0].bucket[2].value, `pos6+1+4`)
  t.strictEqual(child.data[0].bucket[3].value, `pos6+1+5`)
  t.strictEqual(child.data[1].bucket[0].value, `pos6+2`)
  t.strictEqual(child.data[2].bucket[0].value, `pos6+3`)
  t.strictEqual(child.data[3].bucket[0].value, `pos6+4`)
  t.strictEqual(child.data[4].bucket[0].value, `pos6+5`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 8)
})

test('test keys, values, entries', async (t) => {
  const store = memoryStore()
  // use the identity hash from the predictable fill test(s) to spread things out a bit
  let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
  let k = (2 << 4) | 2
  let ids = []
  map = await map.set(Buffer.from([ k, k, k, 1 << 4 ]), 'pos2+1')
  ids.push(map.id)
  t.strictEqual(await map.size(), 1)
  map = await map.set(Buffer.from([ k, k, k, 2 << 4 ]), 'pos2+2')
  ids.push(map.id)
  t.strictEqual(await map.size(), 2)
  map = await map.set(Buffer.from([ k, k, k, 3 << 4 ]), 'pos2+3')
  ids.push(map.id)
  t.strictEqual(await map.size(), 3)
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')
  ids.push(map.id)
  t.strictEqual(await map.size(), 4)

  // you can't normally know the order but in this case it's predictable cause we control the hash
  let expectedKeys = [ '22220000', '22222210', '22222220', '22222230' ]
  let expectedValues = [ 'pos2+0+0', 'pos2+1', 'pos2+2', 'pos2+3' ]
  let expectedEntries = expectedKeys.map((k, i) => { return { key: Buffer.from(k, 'hex'), value: expectedValues[i] } })

  let actual = []
  for await (let k of map.keys()) {
    actual.push(k.toString('hex'))
  }
  t.deepEqual(actual, expectedKeys)

  actual = []
  for await (let v of map.values()) {
    actual.push(v)
  }
  t.deepEqual(actual, expectedValues)

  actual = []
  for await (let e of map.entries()) {
    actual.push(e)
  }
  t.deepEqual(actual, expectedEntries)

  let idCount = 0
  for await (let id of map.ids()) {
    // this is a bit lame but much easier than reverse engineering the hash of the stringified serialized form!
    t.ok(store.map.has(id))
    idCount++
  }
  t.strictEqual(idCount, 7) // 7 nodes deep
})

test('test non-store, sync block-by-block get traversal', async (t) => {
  const store = memoryStore()
  function isEqual (cid1, cid2) { return cid1.equals(cid2) }
  let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
  let k = (2 << 4) | 2
  map = await map.set(Buffer.from([ k, k, 1 << 4 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, 2 << 4 ]), 'pos2+2')
  map = await map.set(Buffer.from([ k, k, 3 << 4 ]), 'pos2+3')
  let deepKey = Buffer.from([ k, k, 0 ])
  map = await map.set(deepKey, 'pos2+0+0')
  let rootBlock = store.load(map.id)

  let currentBlock = rootBlock
  let traversal = iamap.traverseGet(rootBlock, deepKey, isEqual)

  for (let i = 0; i < 4; i++) {
    let expectedChildId = currentBlock.data[0].link
    t.strictDeepEqual(traversal.traverse(), expectedChildId)
    t.strictEqual(traversal.value(), undefined)
    currentBlock = store.load(expectedChildId)
    traversal.next(currentBlock)
  }

  t.strictDeepEqual(traversal.traverse(), null)
  t.strictEqual(traversal.value(), 'pos2+0+0')
})

test('test non-store, sync block-by-block keys traversal', async (t) => {
  const store = memoryStore()
  let map = await iamap.create(store, { hashAlg: 'identity', bitWidth: 4, bucketSize: 2 })
  let k = (2 << 4) | 2
  map = await map.set(Buffer.from([ k, k, 1 << 4 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, 2 << 4 ]), 'pos2+2')
  map = await map.set(Buffer.from([ k, k, 3 << 4 ]), 'pos2+3')
  map = await map.set(Buffer.from([ k, k, 0 ]), 'pos2+0')
  let rootBlock = store.load(map.id)
  let currentBlock = rootBlock

  let traversal = iamap.traverseEntries(rootBlock)

  for (let i = 0; i < 4; i++) {
    t.strictDeepEqual([...traversal.keys()], [])
    t.strictDeepEqual([...traversal.values()], [])
    t.strictDeepEqual([...traversal.entries()], [])
    let id = traversal.traverse()
    t.strictDeepEqual(id, currentBlock.data[0].link)
    currentBlock = store.load(id)
    traversal.next(currentBlock)
  }

  t.strictDeepEqual(
    [...traversal.keys()],
    [ Buffer.from([ k, k, 0 ]), Buffer.from([ k, k, 1 << 4 ]), Buffer.from([ k, k, 2 << 4 ]), Buffer.from([ k, k, 3 << 4 ]) ])
  t.strictDeepEqual(
    [...traversal.values()],
    [ 'pos2+0', 'pos2+1', 'pos2+2', 'pos2+3' ])
  t.strictDeepEqual(
    [...traversal.entries()],
    [ { key: Buffer.from([ k, k, 0 ]), value: 'pos2+0' },
      { key: Buffer.from([ k, k, 1 << 4 ]), value: 'pos2+1' },
      { key: Buffer.from([ k, k, 2 << 4 ]), value: 'pos2+2' },
      { key: Buffer.from([ k, k, 3 << 4 ]), value: 'pos2+3' } ])

  t.strictDeepEqual(traversal.traverse(), null)

  t.strictDeepEqual([...traversal.keys()], [])
  t.strictDeepEqual([...traversal.values()], [])
  t.strictDeepEqual([...traversal.entries()], [])
})

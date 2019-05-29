// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { test } = require('tap')
const { murmurHasher, identityHasher, memoryStore } = require('./common')
const IAMap = require('../')

IAMap.registerHasher('murmur3-32', 32, murmurHasher)
IAMap.registerHasher('identity', 32, identityHasher) // not recommended

test('empty object', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
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

  t.strictEqual(await map.size(), 0)
  t.strictEqual(await map.isInvariant(), true)
})

test('test basic set/get', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const newMap = await map.set('foo', 'bar')

  t.strictEqual(await newMap.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), null)
  t.strictEqual(await newMap.has('foo'), true)
  t.strictEqual(await map.has('nope'), false)
  t.strictEqual(await map.has('foo'), false)

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(newMap.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: newMap.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap.dataMap !== 0)
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
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const newMap1 = await map.set('foo', 'bar')
  const newMap2 = await newMap1.set('foo', 'bar')

  t.strictEqual(await newMap1.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), null)
  t.strictEqual(newMap1, newMap2) // identity match, should be the same object

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(newMap1.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: newMap1.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap1.dataMap !== 0)
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
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const newMap1 = await map.set('foo', 'bar')
  const newMap2 = await newMap1.set('foo', 'baz')

  t.strictEqual(await newMap1.get('foo'), 'bar')
  t.strictEqual(await newMap2.get('foo'), 'baz')
  t.strictEqual(await map.get('foo'), null)
  t.notStrictEqual(newMap1, newMap2) // identity not match

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(newMap1.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: newMap1.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap1.dataMap !== 0)
  t.strictDeepEqual(newMap2.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: newMap1.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'baz' ] ] ]
  })
  t.ok(newMap2.dataMap !== 0)
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
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const setMap = await map.set('foo', 'bar')
  const deleteMap = await setMap.delete('foo')

  t.strictEqual(await deleteMap.get('foo'), null)
  t.strictEqual(await setMap.get('foo'), 'bar')
  t.strictEqual(await map.get('foo'), null)
  t.strictEqual(await setMap.delete('nope'), setMap) // identity match, same map returned

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(setMap.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    dataMap: setMap.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
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

test('test predictable single level fill', async (t) => {
  const store = memoryStore()
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 3 })
  // bitWidth of 4 yields 16 buckets, we can use 'identity' hash to feed keys that we know
  // will go into certain slots
  for (let i = 0; i < 16; i++) {
    map = await map.set(Buffer.from([ i, 0 ]), `value0x${i}`)
  }

  for (let i = 0; i < 16; i++) {
    t.strictEqual(await map.get(Buffer.from([ i, 0 ])), `value0x${i}`)
  }

  // inspect internals
  t.strictEqual(map.elements.length, 16)
  map.elements.forEach((e, i) => {
    t.strictEqual(e.link, null)
    t.ok(Array.isArray(e.bucket))
    t.strictEqual(e.bucket.length, 1)
    t.strictEqual(e.bucket[0].value, `value0x${i}`)
  })

  // fill it right up
  for (let i = 0; i < 16; i++) {
    map = await map.set(Buffer.from([ i, 1 ]), `value1x${i}`)
    map = await map.set(Buffer.from([ i, 2 ]), `value2x${i}`)
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 3; j++) {
      t.strictEqual(await map.get(Buffer.from([ i, j ])), `value${j}x${i}`)
    }
  }

  // inspect internals, we should have 16 buckets with 3 entries each, filling up a single node with no children
  t.strictEqual(map.elements.length, 16)
  map.elements.forEach((e, i) => {
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
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 2 })

  let k = (2 << 4) | 2
  // an 8-bit value with `2` in each of the 4-bit halves, for a `bitWidth` of 4 we are going to collide at
  // the position `2` of each level that we provide it

  map = await map.set(Buffer.from([ k, k, k, 1 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, k, 2 ]), 'pos2+2')

  // check that we have filled our first level, even though we asked for position 2, `elements` is compressed so it still
  // only has one element
  async function validateBaseForm (map) {
    t.strictEqual(await map.get(Buffer.from([ k, k, k, 1 ])), 'pos2+1')
    t.strictEqual(await map.get(Buffer.from([ k, k, k, 2 ])), 'pos2+2')

    t.strictEqual(map.nodeMap, 0)
    t.strictEqual(map.dataMap, 0b100) // data at position 2 but not 1 or 0
    t.strictEqual(map.elements.length, 1)
    t.strictEqual(map.elements[0].link, null)
    t.ok(Array.isArray(map.elements[0].bucket))
    t.strictEqual(map.elements[0].bucket.length, 2)
    t.strictEqual(map.elements[0].bucket[0].value, `pos2+1`)
    t.strictEqual(map.elements[0].bucket[1].value, `pos2+2`)

    t.strictEqual(await map.isInvariant(), true)
    t.strictEqual(await map.size(), 2)
  }
  await validateBaseForm(map)

  // the more we push in with `k` the more we collide and force creation of child nodes to contain them

  map = await map.set(Buffer.from([ k, k, k, 3 ]), 'pos2+3')

  t.strictEqual(map.nodeMap, 0b100) // position 2
  t.strictEqual(map.dataMap, 0)
  t.strictEqual(map.elements.length, 1)
  t.strictEqual(map.elements[0].bucket, null)
  t.strictEqual(typeof map.elements[0].link, 'number') // what's returned by store.save()

  let child = map
  // we can traverse down 5 more levels on the first, and only element
  // because of [k,k,k,k] - each k is 8 bytes so 2 levels of 4 bytes each
  // the 6th level should be where we find our elements because we have non-colliding hash portions
  for (let i = 0; i < 6; i++) {
    t.strictEqual(child.nodeMap, 0b100) // position 2
    t.strictEqual(child.dataMap, 0)
    t.strictEqual(child.elements.length, 1)
    t.strictEqual(child.elements[0].bucket, null)
    t.strictEqual(typeof child.elements[0].link, 'number')
    child = await IAMap.load(store, child.elements[0].link)
  }
  // at the 7th level they all have a different hash portion: 1,2,3 so they should be in separate buckets
  t.strictEqual(child.elements.length, 3)
  t.strictEqual(child.nodeMap, 0)
  t.strictEqual(child.dataMap, 0b1110) // data at positions 1,2,3, but not 0
  for (let i = 0; i < 3; i++) {
    t.strictEqual(child.elements[i].link, null)
    t.ok(Array.isArray(child.elements[i].bucket))
    t.strictEqual(child.elements[i].bucket.length, 1)
    t.strictEqual(child.elements[i].bucket[0].value, `pos2+${i + 1}`)
  }

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)

  // while we have a deep tree, let's test a delete for a missing element at a known deep node
  t.strictEqual(await map.delete(Buffer.from([ k, k, k, 4 ])), map)

  // delete 'pos2+3' and we should be back where we started with just the two at the top level in the same bucket
  map = await map.delete(Buffer.from([ k, k, k, 3 ]))
  await validateBaseForm(map)

// put the awkward one back to re-create the 7-node depth
  map = await map.set(Buffer.from([ k, k, k, 3 ]), 'pos2+3')
  // put one at level 5 so we don't collapse all the way
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')
  t.strictEqual(await map.size(), 4)
  // delete awkward 3rd
  map = await map.delete(Buffer.from([ k, k, k, 3 ]))

  t.strictEqual(await map.get(Buffer.from([ k, k, k, 1 ])), 'pos2+1')
  t.strictEqual(await map.get(Buffer.from([ k, k, k, 2 ])), 'pos2+2')
  t.strictEqual(await map.get(Buffer.from([ k, k, 0, 0 ])), 'pos2+0+0')

  t.strictEqual(await map.size(), 3)

  child = map
  // 4 levels should be the same
  for (let i = 0; i < 4; i++) {
    t.strictEqual(child.nodeMap, 0b100) // position 2
    t.strictEqual(child.dataMap, 0)
    t.strictEqual(child.elements.length, 1)
    t.strictEqual(child.elements[0].bucket, null)
    t.strictEqual(typeof child.elements[0].link, 'number')
    child = await IAMap.load(store, child.elements[0].link)
  }

  t.strictEqual(child.nodeMap, 0)
  t.strictEqual(child.dataMap, 0b101) // data at position 2 and 0
  t.strictEqual(child.elements.length, 2)
  t.strictEqual(child.elements[0].link, null)
  t.ok(Array.isArray(child.elements[0].bucket))
  t.strictEqual(child.elements[0].bucket.length, 1)
  t.strictEqual(child.elements[0].bucket[0].value, `pos2+0+0`)
  t.strictEqual(child.elements[1].link, null)
  t.ok(Array.isArray(child.elements[1].bucket))
  t.strictEqual(child.elements[1].bucket.length, 2)
  t.strictEqual(child.elements[1].bucket[0].value, `pos2+1`)
  t.strictEqual(child.elements[1].bucket[1].value, `pos2+2`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)
})

test('test predictable fill vertical, switched delete', async (t) => {
  const store = memoryStore()
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 2 })
  let k = (2 << 4) | 2
  // 3 elements at the lowest node, one part way back up, like last test
  map = await map.set(Buffer.from([ k, k, k, 1 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, k, 2 ]), 'pos2+2')
  map = await map.set(Buffer.from([ k, k, k, 3 ]), 'pos2+3')
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')

  // now delete one of the lowest to force a different tree form at the mid level
  map = await map.delete(Buffer.from([ k, k, k, 2 ]))

  let child = map
  // 4 levels should be the same
  for (let i = 0; i < 4; i++) {
    t.strictEqual(child.nodeMap, 0b100) // position 2
    t.strictEqual(child.dataMap, 0)
    t.strictEqual(child.elements.length, 1)
    t.strictEqual(child.elements[0].bucket, null)
    t.strictEqual(typeof child.elements[0].link, 'number')
    child = await IAMap.load(store, child.elements[0].link)
  }

  // last level should have 2 buckets but with a bucket in 0 and a node in 2
  t.strictEqual(child.nodeMap, 0)
  t.strictEqual(child.dataMap, 0b101) // data at position 2 and 0
  t.strictEqual(child.elements.length, 2)
  t.strictEqual(child.elements[0].link, null)
  t.ok(Array.isArray(child.elements[0].bucket))
  t.strictEqual(child.elements[0].bucket.length, 1)
  t.strictEqual(child.elements[0].bucket[0].value, `pos2+0+0`)
  t.strictEqual(child.elements[1].link, null)
  t.ok(Array.isArray(child.elements[1].bucket))
  t.strictEqual(child.elements[1].bucket.length, 2)
  t.strictEqual(child.elements[1].bucket[0].value, `pos2+1`)
  t.strictEqual(child.elements[1].bucket[1].value, `pos2+3`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 3)
})

test('test predictable fill vertical, larger buckets', async (t) => {
  const store = memoryStore()
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 4 })
  let k = (6 << 4) | 6 // let's try index 6 now

  // we're trying to trigger a compaction of a node which has a bucket of >1 elements, the first
  // 4 elements here form a bucket at the lowest node, the 5th is in its own bucket
  // removing one of the 4 should collapse that node up into the parent node, but no further
  // because there will be >4 thanks to the last 4 in this list
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 0 ]), 'pos6+1+1')
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 1 ]), 'pos6+1+2')
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 2 ]), 'pos6+1+3')
  map = await map.set(Buffer.from([ k, (1 << 4) | 1, 3 ]), 'pos6+1+4')
  map = await map.set(Buffer.from([ k, (2 << 4) | 1, 5 ]), 'pos6+1+5')
  map = await map.set(Buffer.from([ k, 2 ]), 'pos6+2')
  map = await map.set(Buffer.from([ k, 3 ]), 'pos6+3')
  map = await map.set(Buffer.from([ k, 4 ]), 'pos6+4')
  map = await map.set(Buffer.from([ k, 5 ]), 'pos6+5')

  // now delete one of the lowest to force a different tree form at the mid level
  map = await map.delete(Buffer.from([ k, (1 << 4) | 1, 1 ]))

  let child = map
  // 4 levels should be the same
  for (let i = 0; i < 2; i++) {
    t.strictEqual(child.nodeMap, 0b1000000) // position 6
    t.strictEqual(child.dataMap, 0)
    t.strictEqual(child.elements.length, 1)
    t.strictEqual(child.elements[0].bucket, null)
    t.strictEqual(typeof child.elements[0].link, 'number')
    child = await IAMap.load(store, child.elements[0].link)
  }

  // last level should have 2 buckets but with a bucket in 0 and a node in 2
  t.strictEqual(child.nodeMap, 0)
  t.strictEqual(child.dataMap, 0b111110) // data in postions 1-5
  t.strictEqual(child.elements.length, 5)
  t.strictEqual(child.elements[1].link, null)
  t.ok(Array.isArray(child.elements[1].bucket))
  t.strictEqual(child.elements[0].link, null)
  t.strictEqual(child.elements[1].link, null)
  t.strictEqual(child.elements[2].link, null)
  t.strictEqual(child.elements[3].link, null)
  t.strictEqual(child.elements[4].link, null)
  t.ok(Array.isArray(child.elements[0].bucket))
  t.strictEqual(child.elements[0].bucket.length, 4)
  t.strictEqual(child.elements[0].bucket[0].value, `pos6+1+1`)
  t.strictEqual(child.elements[0].bucket[1].value, `pos6+1+3`)
  t.strictEqual(child.elements[0].bucket[2].value, `pos6+1+4`)
  t.strictEqual(child.elements[0].bucket[3].value, `pos6+1+5`)
  t.strictEqual(child.elements[1].bucket[0].value, `pos6+2`)
  t.strictEqual(child.elements[2].bucket[0].value, `pos6+3`)
  t.strictEqual(child.elements[3].bucket[0].value, `pos6+4`)
  t.strictEqual(child.elements[4].bucket[0].value, `pos6+5`)

  t.strictEqual(await map.isInvariant(), true)
  t.strictEqual(await map.size(), 8)
})

test('test keys, values, entries', async (t) => {
  const store = memoryStore()
  // use the identity hash from the predictable fill test(s) to spread things out a bit
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 2 })
  let k = (2 << 4) | 2
  let ids = []
  map = await map.set(Buffer.from([ k, k, k, 1 ]), 'pos2+1')
  ids.push(map.id)
  t.strictEqual(await map.size(), 1)
  map = await map.set(Buffer.from([ k, k, k, 2 ]), 'pos2+2')
  ids.push(map.id)
  t.strictEqual(await map.size(), 2)
  map = await map.set(Buffer.from([ k, k, k, 3 ]), 'pos2+3')
  ids.push(map.id)
  t.strictEqual(await map.size(), 3)
  map = await map.set(Buffer.from([ k, k, 0, 0 ]), 'pos2+0+0')
  ids.push(map.id)
  t.strictEqual(await map.size(), 4)

  // you can't normally know the order but in this case it's predictable cause we control the hash
  let expectedKeys = [ '22220000', '22222201', '22222202', '22222203' ]
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

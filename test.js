const murmurhash3 = require('murmurhash3js-revisited')
const assert = require('assert')
const { test } = require('tap')
const IAMap = require('./')

IAMap.registerHasher('murmur3-32', 32, (key) => {
  assert(Buffer.isBuffer(key))
  let b = Buffer.alloc(4)
  b.writeUInt32LE(murmurhash3.x86.hash32(key))
  return b
})
// probably best not to use this for real applications, unless your keys have the qualities of hashes
IAMap.registerHasher('identity', 32, (key) => {
  assert(Buffer.isBuffer(key))
  return key
})

// simple util to generate stable content IDs for objects, this is not necessarily how
// you'd use IAMap, ideally your backing store would generate IDs for you, such as a
// CID for IPLD.

function hash (obj) {
  return murmurhash3.x86.hash32(Buffer.from(JSON.stringify(obj)))
}

function memoryStore () {
  return {
    map: new Map(),
    saves: 0,
    loads: 0,
    save (obj) {
      let id = hash(obj)
      this.map.set(id, obj)
      this.saves++
      return id
    },
    load (id) {
      this.loads++
      return this.map.get(id)
    },
    isEqual (id1, id2) {
      return id1 === id2
    }
  }
}

test('empty object', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictEqual(store.map.size, 1)
  t.strictEqual(store.saves, 1)
  t.strictEqual(store.loads, 0)
})

test('test basic set/get', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const newMap = await map.set('foo', 'bar')

  t.strictEqual('bar', await newMap.get('foo'))
  t.strictEqual(null, await map.get('foo'))

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(newMap.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
    dataMap: newMap.dataMap,
    nodeMap: 0,
    elements: [ [ [ Buffer.from('foo'), 'bar' ] ] ]
  })
  t.ok(newMap.dataMap !== 0)
  t.strictEqual(store.map.size, 2)
  t.strictEqual(store.saves, 2)
  t.strictEqual(store.loads, 0)
})

test('test basic set/get/delete', async (t) => {
  const store = memoryStore()
  const map = await IAMap.create(store, { codec: 'murmur3-32' })
  const setMap = await map.set('foo', 'bar')
  const deleteMap = await setMap.delete('foo')

  t.strictEqual(null, await deleteMap.get('foo'))
  t.strictEqual('bar', await setMap.get('foo'))
  t.strictEqual(null, await map.get('foo'))

  // original map isn't mutated
  t.strictDeepEqual(map.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
    dataMap: 0,
    nodeMap: 0,
    elements: []
  })
  t.strictDeepEqual(setMap.toSerializable(), {
    codec: Buffer.from([ 0x23 ]),
    bitWidth: 5,
    bucketSize: 8,
    depth: 0,
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

test('test predictable fill vertical', async (t) => {
  const store = memoryStore()
  let map = await IAMap.create(store, { codec: 'identity', bitWidth: 4, bucketSize: 2 })

  let k = (2 << 4) | 2
  // an 8-bit value with `2` in each of the 4-bit halves, for a `bitWidth` of 4 we are going to collide at
  // the position `2` of each level that we provide it

  map = await map.set(Buffer.from([ k, k, k, 1 ]), 'pos2+1')
  map = await map.set(Buffer.from([ k, k, k, 2 ]), 'pos2+2')

  // check that we have filled our first level, even though we asked for position 2, `elements` is compressed so it still
  // only has one element
  t.strictEqual(map.nodeMap, 0)
  t.strictEqual(map.dataMap, 0b100) // data at position 2 but not 1 or 0
  t.strictEqual(map.elements.length, 1)
  t.strictEqual(map.elements[0].link, null)
  t.ok(Array.isArray(map.elements[0].bucket))
  t.strictEqual(map.elements[0].bucket.length, 2)
  t.strictEqual(map.elements[0].bucket[0].value, `pos2+1`)
  t.strictEqual(map.elements[0].bucket[1].value, `pos2+2`)

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
  for (let i = 0; i < 5; i++) {
    child = await IAMap.load(store, child.elements[0].link)
    t.strictEqual(child.nodeMap, 0b100) // position 2
    t.strictEqual(child.dataMap, 0)
    t.strictEqual(child.elements.length, 1)
    t.strictEqual(child.elements[0].bucket, null)
    t.strictEqual(typeof child.elements[0].link, 'number')
  }
  child = await IAMap.load(store, child.elements[0].link)
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

  // delete 'pos2+3' and we should be back where we started with just the two at the top level in the same bucket
  map = await map.delete(Buffer.from([ k, k, k, 3 ]))

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
})

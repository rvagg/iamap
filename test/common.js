// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const murmurhash3 = require('murmurhash3js-revisited')
const assert = require('assert')

function murmurHasher (key) {
  assert(Buffer.isBuffer(key))
  const b = Buffer.alloc(4)
  b.writeUInt32LE(murmurhash3.x86.hash32(key))
  return b
}

// probably best not to use this for real applications, unless your keys have the qualities of hashes
function identityHasher (key) {
  assert(Buffer.isBuffer(key))
  return key
}

function hash (obj) {
  return murmurhash3.x86.hash32(Buffer.from(JSON.stringify(obj)))
}

// simple util to generate stable content IDs for objects, this is not necessarily how
// you'd use IAMap, ideally your backing store would generate IDs for you, such as a
// CID for IPLD.

function memoryStore () {
  return {
    map: new Map(),
    saves: 0,
    loads: 0,
    save (obj) { // this can be async
      const id = hash(obj)
      this.map.set(id, obj)
      this.saves++
      return id
    },
    load (id) { // this can be async
      this.loads++
      return this.map.get(id)
    },
    isEqual (id1, id2) {
      return id1 === id2
    },
    isLink (obj) {
      return typeof obj === 'number'
    }
  }
}

module.exports.identityHasher = identityHasher
module.exports.murmurHasher = murmurHasher
module.exports.memoryStore = memoryStore

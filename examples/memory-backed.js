// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const fs = require('fs').promises
const path = require('path')
const murmurhash3 = require('murmurhash3js-revisited')
const iamap = require('../')

/*

An example memory-backed IAMap
This is not a realistic example because you can just use a `Map` directly, but it's useful for demonstrating
the basics of how it works and can form the basis of something more sophisticated, such as a database-backed
store.

*/

// create a fresh memory-backed store on demand
function memoryStore () {
  // We're using a hash function here to generate identifiers, this should not be confused with the 'codec'
  // that IAMap takes as an option. This is purely for the generation of content hashes, such that identically
  // shaped objects passed through `save()` generate the same hash. A content addressed storage system would
  // normally perform this function for you.
  function hash (obj) {
    const stringified = JSON.stringify(obj)
    const buf = new TextEncoder().encode(stringified) // murmurhash3js-revisited takes bytes[]
    return murmurhash3.x86.hash32(buf) // returns an number
  }
  const map = new Map() // where objects get stored

  return {
    save (obj) { // this can be async
      const id = hash(obj)
      map.set(id, obj)
      return id
    },
    load (id) { // this can be async
      return map.get(id)
    },
    // this needs to work for the type of objects returned by `save()`, which is numbers for our `hash()` function
    // so it's a straight compare. If you had a more complex identifier, such as an object or a byte array, you'd
    // perform an appropriate comparison here.
    isEqual (id1, id2) {
      return id1 === id2
    },
    isLink (obj) {
      return typeof obj === 'number'
    }
  }
}

// IAMap doesn't know how to produce a hash for keys by itself, it needs a hash function. We do that by passing in
// a hash function via `registerHasher()`. The hash function should work on an array of bytes (`Uint8Array`) and return
// an array of bytes whose length matches the `hashLength` that we provide to `registerHasher()`.
function murmurHasher (key) {
  // key is a `Uint8Array`
  const b = new Uint8Array(4)
  const view = new DataView(b.buffer)
  view.setUint32(0, murmurhash3.x86.hash32(key), true)
  // we now have a 4-byte hash
  return b
}

// Names must match a multicodec name, see https://github.com/multiformats/multicodec/blob/master/table.csv
iamap.registerHasher(0x23 /* 'murmur3-32' */, 32, murmurHasher)

async function memoryBacked () {
  const store = memoryStore() // new store
  let map = await iamap.create(store, { hashAlg: 0x23 }) // new map with default options, our hasher and custom store

  for await (const pkg of findPackages(path.join(__dirname, '..'))) {
    // Store a string key and a JavaScript object as a value, this will work for our store but if we needed to store it
    // elsewhere our store.save() is going to be in trouble because the keys and values will show up like they are here.
    // In some cases, introducing a link-layer might be in order, only insert links as values and allow them to easily
    // resolve in a wrapper layer or somewhere else
    // Note also that we are overwriting the `map` object here—IAMap is immutable so the mutation methods return an entirely
    // new instance with the changes (CoW style)
    map = await map.set(`${pkg.name}@${pkg.version}`, pkg)
  }

  const textDecoder = new TextDecoder()
  // iterate with `entries()` which has no guarantees of meaningful order
  for await (const entry of map.entries()) {
    console.log(`${textDecoder.decode(entry.key)}${Array(Math.max(0, 30 - entry.key.length)).join(' ')} ${entry.value.description}`)
  }

  console.log(`IAMap serialized in store as ${map.id}`)
}

// recursive async iterator that finds and emits all package.json files found from our parent directory downward
async function * findPackages (dir) {
  const files = await fs.readdir(dir)
  for (const f of files) {
    const fp = path.join(dir, f)
    if (f === 'package.json') {
      try {
        const pkg = JSON.parse(await fs.readFile(fp, 'utf8'))
        if (pkg.version && pkg.name) {
          yield pkg
        }
      } catch (e) {}
    }
    if ((await fs.stat(fp)).isDirectory()) {
      yield * findPackages(fp)
    }
  }
}

memoryBacked().catch((err) => console.error(err))

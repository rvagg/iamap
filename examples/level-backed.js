#!/usr/bin/env node

// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

// Needs additional dependencies: npm i level ipld-dag-cbor multihashing multicodec cids split2
// Run with `node --no-warnings` to suppress any experimental warnings

/*

This example uses IAMap to crate an index of all module names `require()`d by .js files in a given
directory (and any of its subdirectories). You can then use that index to find a list of files that
use a particular module.

Usage:
  level-backed.js --index <dir>
    - build an index of require()'d modules inside .js files contained in 'dir' (recursively searched)
    - returns a map ID that you can use for --search and --stats

  level-backed.js --search <indexId> <module>
    - search an index, identified by 'indexId', for all files that require() a 'module'

  level-backed.js --stats <indexId>
    - print some basic stats of the index identified by 'indexId'

We use a LevelDB data store keyed by content identifiers (CIDs) storing CBOR encoded objets to simulate
a content-addressed backing store. Obviously LevelDB is a good enough key/value store on its own, this
is just an example! However, this approach could be used to efficiently generate a set of { CID, block }
pairs to be fed into another data store like IPFS.

In the process of building the data structures, we generate a lot of intermediate nodes that are not
used in the final form of the map. Our data store is simulating an append-only store so there is not
delete option and we'll end up with a lot of cruft. We can use `map.ids()` (as well as `map.values()`
where the values are CIDs, which they are in this case) to extract the CIDs that comprise the final
form and therefore need to be preserved. The rest could be discarded.

Our basic map structure comprises a set of key/value pairs, where the key is a module name (string) and
the value _represents_ a list of all files that use that module. As that list of files can be quite
large (and therefore result in large CBOR encoded blocks if encoded directly), we instead store a CID
identifying secondary IAMap that is used like a Set, where its `keys()` yield a list of files. So we are
storing IAMap's within an IAMap and using the root as a Map and the values are Sets.

*/

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')
const murmurhash3 = require('murmurhash3js-revisited')
const level = require('level')
const dagCbor = require('ipld-dag-cbor')
const multihashing = require('multihashing')
const multicodec = require('multicodec')
const CID = require('cids')
const split2 = require('split2')
const IAMap = require('../')

const dbLocation = '/tmp/iamap-level-example.db'

const serialize = dagCbor.util.serialize
const deserialize = dagCbor.util.deserialize

const store = {
  stats: {
    loads: 0,
    saves: 0
  },
  // we're going to store Base58-encoded string representations of CIDs as our keys and
  // CBOR (binary) encoded objects as the values
  backingDb: level(dbLocation, { keyEncoding: 'ascii', valueEncoding: 'binary' }),
  encode: async (obj) => {
    let block = await serialize(obj)
    let multihash = multihashing(block, dagCbor.util.defaultHashAlg)
    let cid = new CID(1, multicodec.print[multicodec.DAG_CBOR], multihash)
    return { cid, block }
  },
  decode: async (block) => {
    return deserialize(block)
  },

  // These next 3 methods are used by IAMap, they are part of the required IAMap `store` interface
  save: async (value) => {
    // Save some arbitrary object to our store. When IAMap uses this it's saving a plain object
    // representation of an IAMap node. See IAMap#toSerializable() for information on that form.
    store.stats.saves++
    let { cid, block } = await store.encode(value)
    await store.backingDb.put(cid.toBaseEncodedString(), block)
    return cid
  },
  // Load some arbitrary object from our store. When IAMap uses this, it's expecting a plain object
  // representation of an IAMap that it can deserialise. See IAMap#fromSerializable().
  load: async (id) => {
    store.stats.loads++
    assert(CID.isCID(id))
    let block = await store.backingDb.get(id.toBaseEncodedString())
    return store.decode(block)
  },
  // Equality test two identifiers, IAMap uses this and because save() returns CIDs we're comparing those
  isEqual: (id1, id2) => {
    return id1.equals(id2)
  }
}

// Register a murmur3-32 hasher with IAMap
function murmurHasher (key) {
  // key is a `Buffer`
  let b = Buffer.alloc(4)
  b.writeUInt32LE(murmurhash3.x86.hash32(key))
  // we now have a 4-byte hash
  return b
}
// Names must match a multicodec name, see https://github.com/multiformats/multicodec/blob/master/table.csv
IAMap.registerHasher('murmur3-32', 32, murmurHasher)

// recursive async iterator that finds and emits all package.json files found from our parent directory downward
async function * findJs (dir) {
  let files = await fs.promises.readdir(dir)
  for (let f of files) {
    let fp = path.join(dir, f)
    let stat = await fs.promises.stat(fp)
    if (stat.isFile() && f.endsWith('.js')) {
      yield fp
    }
    if (stat.isDirectory()) {
      yield * findJs(fp)
    }
  }
}

// Given a directory, find all of the .js files in it and match every instance of require() and extract
// the module being used. We're ignoring modules starting with '.' and also anything after '/' if used.
// Emit [ file, module ] pairs for every valid require() found.
async function * findRequires (dir) {
  const requireRe = /require\(['"]([^.][^'"/]*)/g

  for await (let file of findJs(dir)) {
    file = path.resolve(process.cwd(), file) // absolute
    yield * fs.createReadStream(file)
      .pipe(split2({ objectMode: true }))
      .pipe(new Transform({
        objectMode: true,
        transform (line, enc, callback) {
          let match
          while ((match = requireRe.exec(line)) != null) {
            this.push([ file, match[1] ])
          }
          callback()
        }
      }))
  }
}

// Simple utility to create or load an IAMap. If `id` is not supplied it'll make a new one, otherwise
// it assumes its a CID
async function createMap (id) {
  if (id) { // existing
    if (!CID.isCID(id)) {
      id = new CID(id)
    }
    return IAMap.load(store, id)
  }
  // new map with default options, our hasher and custom store
  return IAMap.create(store, { hashAlg: 'murmur3-32' })
}

// --index <dir>
async function buildIndex (dir) {
  console.log(`Using database at ${dbLocation}`)
  process.stdout.write('Building index ')

  let map = await createMap()

  let c = 0
  for await (let req of findRequires(dir)) {
    if (++c % 1000 === 0) {
      process.stdout.write('.')
    }

    let [ file, mod ] = req // findRequires() emits pairs in an array
    let listId = await map.get(mod)
    let list
    if (!listId) { // new module, make a new Set out of a new IAMap
      list = await createMap()
    } else { // module we've seen before, load it
      list = await createMap(listId)
    }
    // update the Set with `file`, note the `list =` because of the mutation
    list = await list.set(file, true) // `true` because we don't care about the value here, we're using it as a Set
    // put the new Set's ID as the value of `mod` in our main IAMap, note the `map =` because of the mutation
    map = await map.set(mod, list.id)
  }

  console.log(`\nComplete! Scanned ${c} files, Map root is ${map.id}`)
  console.log(`Search by running again with \`--search ${map.id} <module>\``)
}

// --search <id> <module>
async function search (mapId, mod) {
  console.log(`Using database at ${dbLocation}`)
  let map = await createMap(mapId)
  let listId = await map.get(mod)
  if (listId) {
    // if `mod` was found, we should now have an ID of a separate IAMap that is used as a Set
    let list = await createMap(listId)
    console.log(`'${mod}' is found in:`)
    for await (let f of list.keys()) { // we stored files as keys, so only list the keys
      console.log(`  ${f}`)
    }
  } else {
    console.log(`'${mod}' not found`)
  }
}

// --stats <id>
async function stats (mapId) {
  console.log(`Using database at ${dbLocation}`)
  let map = await createMap(mapId)
  let size = 0 // could use map.size() for this
  let nodes = 0
  let maxDepth = 0
  let maxUsedCount = 0
  let maxUsed
  let files = 0
  // map.ids() gives us IDs of the root node and all of its children
  for await (let id of map.ids()) {
    // instantiate a detached node, we wouldn't normally do this and we certainly wouldn't mutate this
    let node = await createMap(id)
    nodes++
    if (node.depth > maxDepth) {
      maxDepth = node.depth
    }
    size += node.directEntryCount() // direct entries within buckets of this node (only)
  }

  for await (let entry of map.entries()) { // map.entries() gives us every { key, value } pair in this map
    let list = await createMap(entry.value) // every value in our map is a CID of a new IAMap used as a Set
    let listSize = await list.size() // list.size() is the number of entries in this IAMap (Set)
    files += listSize
    if (listSize > maxUsedCount) {
      maxUsedCount = listSize
      maxUsed = entry.key // the key was the module name
    }
  }

  console.log(`Map comprises ${nodes} nodes, with a maximum depth of ${maxDepth + 1}, holding ${size} entries referencing ${files} files`)
  console.log(`Most used module is '${maxUsed}' with ${maxUsedCount} files`)
}

function printUsage () {
  console.error(`Usage:

  level-backed.js --index <dir>
    - build an index of require()'d modules inside .js files contained in 'dir' (recursively searched)
    - returns a map ID that you can use for --search and --stats

  level-backed.js --search <indexId> <module>
    - search an index, identified by 'indexId', for all files that require() a 'module'

  level-backed.js --stats <indexId>
    - print some basic stats of the index identified by 'indexId'`)
}

if (process.argv[2] === '--index') {
  if (!process.argv[3]) {
    printUsage()
  }
  buildIndex(process.argv[3]).catch((err) => console.error(err))
} else if (process.argv[2] === '--search') {
  if (process.argv.length !== 5) {
    printUsage()
  }
  search(process.argv[3], process.argv[4]).catch((err) => console.error(err))
} else if (process.argv[2] === '--stats') {
  if (process.argv.length !== 4) {
    printUsage()
  }
  stats(process.argv[3]).catch((err) => console.error(err))
} else {
  printUsage()
}

// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const assert = require('assert')
const { mask, setBit, bitmapHas, index } = require('./bit-utils')
const multicodec = {
  codes: require('multicodec/src/base-table'),
  names: require('multicodec/src/name-table')
}

const defaultBitWidth = 5 // 2^5 = 32 buckets per node
const defaultBucketSize = 8 // array size for a bucket of values

const hasherRegistry = {}

/**
 * ```js
 * let map = await IAMap.create(store, options)
 * ```
 *
 * Create a new IAMap instance with a backing store. This operation is asynchronous and returns a `Promise` that
 * resolves to a `IAMap` instance.
 *
 * @name IAMap.create
 * @function
 * @async
 * @param {Object} store - A backing store for this Map. The store should be able to save and load a serialised
 * form of a single node of a IAMap which is provided as a plain object representation. `store.save(node)` takes
 * a serialisable node and should return a content address / ID for the node. `store.load(id)` serves the inverse
 * purpose, taking a content address / ID as provided by a `save()` operation and returning the serialised form
 * of a node which can be instantiated by IAMap. In addition, a `store.isEqual(id1, id2)` method is required to
 * check the equality of the two content addresses / IDs (which may be custom for that data type).
 * The `store` object should take the following form: `{ async save(node):id, async load(id):node, isEqual(id,id):boolean }`
 * @param {Object} options - Options for this IAMap
 * @param {string} options.hashAlg - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv)
 * hash function identifier, e.g. `'murmur3-32'`. Hash functions must be registered with {@link IAMap.registerHasher}.
 * @param {number} [options.bitWidth=5] - The number of bits to extract from the hash to form a data element index at
 * each level of the Map, e.g. a bitWidth of 5 will extract 5 bits to be used as the data element index, since 2^5=32,
 * each node will store up to 32 data elements (child nodes and/or entry buckets). The maximum depth of the Map is
 * determined by `floor((hashBytes * 8) / bitWidth)` where `hashBytes` is the number of bytes the hash function
 * produces, e.g. `hashBytes=32` and `bitWidth=5` yields a maximum depth of 51 nodes. The maximum `bitWidth`
 * currently allowed is `8` which will store 256 data elements in each node.
 * @param {number} [options.bucketSize=8] - The maximum number of collisions acceptable at each level of the Map. A
 * collision in the `bitWidth` index at a given depth will result in entries stored in a bucket (array). Once the
 * bucket exceeds `bucketSize`, a new child node is created for that index and all entries in the bucket are
 * pushed
 */
async function create (store, options, map, depth, data) {
  // map, depth and data are intended for internal use
  let newNode = new IAMap(store, options, map, depth, data)
  return save(store, newNode)
}

/**
 * ```js
 * let map = await IAMap.load(store, id)
 * ```
 *
 * Create a IAMap instance loaded from a serialised form in a backing store. See {@link IAMap.create}.
 *
 * @name IAMap.load
 * @function
 * @async
 * @param {Object} store - A backing store for this Map. See {@link IAMap.create}.
 * @param id - An content address / ID understood by the backing `store`.
 */
async function load (store, id, depth = 0, options) {
  // depth and options are internal arguments that the user doesn't need to interact with
  if (depth !== 0 && typeof options !== 'object') {
    throw new Error('Cannot load() without options at depth > 0')
  }
  let serialized = await store.load(id)
  return fromSerializable(store, id, serialized, options, depth)
}

/**
 * ```js
 * IAMap.registerHasher(hashAlg, hashBytes, hasher)
 * ```
 *
 * Register a new hash function. IAMap has no hash functions by default, at least one is required to create a new
 * IAMap.
 *
 * @name IAMap.registerHasher
 * @function
 * @param {string} hashAlg - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv) hash
 * function identifier, e.g. `'murmur3-32'`.
 * @param {number} hashBytes - The number of bytes to use from the result of the `hasher()` function (e.g. `32`)
 * @param {function} hasher - A hash function that takes a `Buffer` derived from the `key` values used for this
 * Map and returns a `Buffer` (or a `Buffer`-like, such that each data element of the array contains a single byte value).
 */
function registerHasher (hashAlg, hashBytes, hasher) {
  if (!multicodec.codes[hashAlg]) {
    throw new TypeError(`hashAlg '${hashAlg}' is not in the multicodec database`)
  }
  if (typeof hashBytes !== 'number') {
    throw new TypeError('Invalid `hashBytes`')
  }
  if (typeof hasher !== 'function') {
    throw new TypeError('Invalid `hasher` function }')
  }
  hasherRegistry[hashAlg] = { hashBytes, hasher }
}

// simple stable key/value representation
class KV {
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  toSerializable () {
    return [ this.key, this.value ]
  }
}

KV.fromSerializable = function (obj) {
  assert(Array.isArray(obj))
  assert.strictEqual(obj.length, 2)
  return new KV(obj[0], obj[1])
}

// a element in the data array that each node holds, each element could be either a container of
// an array (bucket) of KVs or a link to a child node
class Element {
  constructor (bucket, link) {
    this.bucket = bucket || null
    this.link = link !== undefined ? link : null
    assert.strictEqual(this.bucket === null, this.link !== null)
  }

  toSerializable () {
    if (this.bucket) {
      return this.bucket.map((c) => {
        return c.toSerializable()
      })
    } else {
      assert(!IAMap.isIAMap(this.link))
      return { link: this.link }
    }
  }
}

Element.fromSerializable = function (obj) {
  if (Array.isArray(obj)) {
    return new Element(obj.map(KV.fromSerializable))
  } else if (obj && obj.link && Object.keys(obj).length === 1) {
    return new Element(null, obj.link)
  } else {
    assert.fail('badly formed data element')
  }
}

/**
 * Immutable Asynchronous Map
 *
 * The `IAMap` constructor should not be used directly. Use `IAMap.create()` or `IAMap.load()` to instantiate.
 *
 * @class
 * @property {any} id - A unique identifier for this `IAMap` instance. IDs are generated by the backing store and
 * are returned on `save()` operations.
 * @property {string} config.hashAlg - The hash function used by this `IAMap` instance. See {@link IAMap.create} for more
 * details.
 * @property {number} config.bitWidth - The number of bits used at each level of this `IAMap`. See {@link IAMap.create}
 * for more details.
 * @property {number} config.bucketSize - TThe maximum number of collisions acceptable at each level of the Map.
 * @property {number} [map=0] - Bitmap indicating which slots are occupied by data entries or child node links,
 * each data entry contains an bucket of entries.
 * @property {number} [depth=0] - Depth of the current node in the IAMap, `depth` is used to extract bits from the
 * key hashes to locate slots
 * @property {Array} [data=[]] - Array of data elements (an internal `Element` type), each of which contains a
 * bucket of entries or an ID of a child node
 * See {@link IAMap.create} for more details.
 */
class IAMap {
  /**
   * @ignore
   * @private
   */
  constructor (store, options, map, depth, data) {
    if (!store || typeof store.save !== 'function' ||
        typeof store.load !== 'function' ||
        typeof store.isEqual !== 'function') {
      throw new TypeError('Invalid `store` option, must be of type: { save(node):id, load(id):node, isEqual(id,id):boolean }')
    }
    ro(this, 'store', store)

    this.id = null
    ro(this, 'config', buildConfig(options))

    let hashBytes = hasherRegistry[options.hashAlg].hashBytes

    if (map !== undefined && typeof map !== 'number') {
      throw new TypeError('`map` must be a Number')
    }
    ro(this, 'map', map || 0)

    if (depth !== undefined && (!Number.isInteger(depth) || depth < 0)) {
      throw new TypeError('`depth` must be an integer >= 0')
    }
    ro(this, 'depth', depth || 0)
    if (this.depth > Math.floor((hashBytes * 8) / this.config.bitWidth)) {
      // our hasher only has `hashBytes` to work with and we take off `bitWidth` bits with each level
      // e.g. 32-byte hash gives us a maximum depth of 51 levels
      throw new Error('Overflow: maximum tree depth reached')
    }

    ro(this, 'data', Object.freeze(data || []))
    for (let e of this.data) {
      if (!(e instanceof Element)) {
        throw new TypeError('`data` array must contain only `Element` types')
      }
    }
  }

  /**
   * Asynchronously create a new `IAMap` instance identical to this one but with `key` set to `value`.
   *
   * @param {(string|array|Buffer|ArrayBuffer)} key - A key for the `value` being set whereby that same `value` may
   * be retrieved with a `get()` operation with the same `key`. The type of the `key` object should either be a
   * `Buffer` or be convertable to a `Buffer` via [`Buffer.from()`](https://nodejs.org/api/buffer.html).
   * @param {any} value - Any value that can be stored in the backing store. A value could be a serialisable object
   * or an address or content address or other kind of link to the actual value.
   * @returns {Promise<IAMap>} A `Promise` containing a new `IAMap` that contains the new key/value pair.
   * @async
   */
  async set (key, value) {
    if (!Buffer.isBuffer(key)) {
      key = Buffer.from(key)
    }
    const hash = hasher(this)(key)
    assert(Buffer.isBuffer(hash))
    const bitpos = mask(hash, this.depth, this.config.bitWidth)

    if (bitmapHas(this.map, bitpos)) { // should be in a bucket in this node
      let { data, link } = findElement(this, bitpos, key)
      if (data) {
        if (data.found) {
          if (data.bucketEntry.value === value) {
            return this // no change, identical value
          }
          // replace entry for this key with a new value
          // note that === will fail for two complex objects representing the same data so we may end up
          // with a node of the same ID anyway
          return updateBucket(this, data.elementAt, data.bucketIndex, key, value)
        } else {
          if (data.element.bucket.length >= this.config.bucketSize) {
            // too many collisions at this level, replace a bucket with a child node
            return (await replaceBucketWithNode(this, bitpos, data.elementAt)).set(key, value)
          }
          // insert into the bucket and sort it
          return updateBucket(this, data.elementAt, -1, key, value)
        }
      } else { // link
        let child = await load(this.store, link.element.link, this.depth + 1, this.config)
        assert(child)
        let newChild = await child.set(key, value)
        return updateNode(this, link.elementAt, key, newChild)
      }
    } else { // we don't have an element for this hash portion, make one
      return addNewElement(this, bitpos, key, value)
    }
  }

  /**
   * Asynchronously find and return a value for the given `key` if it exists within this `IAMap`.
   *
   * @param {string|array|Buffer|ArrayBuffer} key - A key for the value being sought. See {@link IAMap#set} for
   * details about acceptable `key` types.
   * @returns {Promise} A `Promise` that resolves to the value being sought if that value exists within this `IAMap`. If the
   * key is not found in this `IAMap`, the `Promise` will resolve to `null`.
   * @async
   */
  async get (key) {
    const traversal = traverse(this.config, this, this.depth, key, this.store.isEqual)
    if (traversal.nextId !== null) {
      let child = await load(this.store, traversal.nextId, this.depth + 1, this.config)
      assert(child)
      return child.get(key)
    }
    return traversal.value
  }

  /**
   * Asynchronously find and return a boolean indicating whether the given `key` exists within this `IAMap`
   *
   * @param {string|array|Buffer|ArrayBuffer} key - A key to check for existence within this `IAMap`. See
   * {@link IAMap#set} for details about acceptable `key` types.
   * @returns {Promise<boolean>} A `Promise` that resolves to either `true` or `false` depending on whether the `key` exists
   * within this `IAMap`.
   * @async
   */
  async has (key) {
    return (await this.get(key)) !== null
  }

  /**
   * Asynchronously create a new `IAMap` instance identical to this one but with `key` and its associated
   * value removed. If the `key` does not exist within this `IAMap`, this instance of `IAMap` is returned.
   *
   * @param {string|array|Buffer|ArrayBuffer} key - A key to remove. See {@link IAMap#set} for details about
   * acceptable `key` types.
   * @returns {Promise<IAMap>} A `Promise` that resolves to a new `IAMap` instance without the given `key` or the same `IAMap`
   * instance if `key` does not exist within it.
   * @async
   */
  async delete (key) {
    if (!Buffer.isBuffer(key)) {
      key = Buffer.from(key)
    }
    const hash = hasher(this)(key)
    assert(Buffer.isBuffer(hash))
    const bitpos = mask(hash, this.depth, this.config.bitWidth)

    if (bitmapHas(this.map, bitpos)) { // should be in a bucket in this node
      let { data, link } = findElement(this, bitpos, key)
      if (data) {
        if (data.found) {
          if (this.depth !== 0 && this.directNodeCount() === 0 && this.directEntryCount() === this.config.bucketSize + 1) {
            // current node will only have this.config.bucketSize entries spread across its buckets
            // and no child nodes, so wrap up the remaining nodes in a fresh IAMap at depth 0, it will
            // bubble up to either become the new root node or be unpacked by a higher level
            return collapseIntoSingleBucket(this, hash, data.elementAt, data.bucketIndex)
          } else {
            // we'll either have more entries left than this.config.bucketSize or we're at the root node
            // so this is a simple bucket removal, no collapsing needed (root nodes can't be collapsed)
            let lastInBucket = this.data.length === 1
            // we have at least one child node or too many entries in buckets to be collapsed
            let newData = removeFromBucket(this.data, bitpos, data.elementAt, lastInBucket, data.bucketIndex)
            let newMap = this.map
            if (lastInBucket) {
              newMap = setBit(newMap, bitpos, 0)
            }
            return create(this.store, this.config, newMap, this.depth, newData)
          }
        } else {
          // key would be located here according to hash, but we don't have it
          return this
        }
      } else { // link
        let child = await load(this.store, link.element.link, this.depth + 1, this.config)
        assert(child)
        let newChild = await child.delete(key)
        if (this.store.isEqual(newChild.id, link.element.link)) { // no modification
          return this
        }

        assert(newChild.data.length > 0) // something probably went wrong in the map block above

        if (newChild.directNodeCount() === 0 && newChild.directEntryCount() === this.config.bucketSize) {
          // child got collapsed
          if (this.directNodeCount() === 1 && this.directEntryCount() === 0) {
            // we only had one node to collapse and the child was collapsible so end up acting the same
            // as the child, bubble it up and it either becomes the new root or finds a parent to collapse
            // in to (next section)
            return newChild
          } else {
            // extract data elements from this returned node and merge them into ours
            return collapseNodeInline(this, bitpos, newChild)
          }
        } else {
          // simple node replacement with edited child
          return updateNode(this, link.elementAt, key, newChild)
        }
      }
    } else { // we don't have an element for this hash portion
      return this
    }
  }

  /**
   * Asynchronously count the number of key/value pairs contained within this `IAMap`, including its children.
   *
   * @returns {Promise<number>} A `Promise` with a `number` indicating the number of key/value pairs within this `IAMap` instance.
   * @async
   */
  async size () {
    let c = 0
    for (let e of this.data) {
      if (e.bucket) {
        c += e.bucket.length
      } else {
        let child = await load(this.store, e.link, this.depth + 1, this.config)
        c += await child.size()
      }
    }
    return c
  }

  /**
   * Asynchronously emit all keys that exist within this `IAMap`, including its children. This will cause a full
   * traversal of all nodes.
   *
   * @returns {AsyncIterator} An async iterator that yields keys. All keys will be in `Buffer` format regardless of which
   * format they were inserted via `set()`.
   * @async
   */
  async * keys () {
    for (let e of this.data) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield kv.key
        }
      } else {
        let child = await load(this.store, e.link, this.depth + 1, this.config)
        yield * child.keys()
      }
    }
  }

  /**
   * Asynchronously emit all values that exist within this `IAMap`, including its children. This will cause a full
   * traversal of all nodes.
   *
   * @returns {AsyncIterator} An async iterator that yields values.
   * @async
   */
  async * values () {
    for (let e of this.data) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield kv.value
        }
      } else {
        let child = await load(this.store, e.link, this.depth + 1, this.config)
        yield * child.values()
      }
    }
  }

  /**
   * Asynchronously emit all { key, value } pairs that exist within this `IAMap`, including its children. This will
   * cause a full traversal of all nodes.
   *
   * @returns {AsyncIterator} An async iterator that yields objects with the properties `key` and `value`.
   * @async
   */
  async * entries () {
    for (let e of this.data) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield { key: kv.key, value: kv.value }
        }
      } else {
        let child = await load(this.store, e.link, this.depth + 1, this.config)
        yield * child.entries()
      }
    }
  }

  /**
   * Asynchronously emit the IDs of this `IAMap` and all of its children.
   *
   * @returns {AsyncIterator} An async iterator that yields the ID of this `IAMap` and all of its children. The type of ID is
   * determined by the backing store which is responsible for generating IDs upon `save()` operations.
   */
  async * ids () {
    yield this.id
    for (let e of this.data) {
      if (e.link) {
        let child = await load(this.store, e.link, this.depth + 1, this.config)
        yield * child.ids()
      }
    }
  }

  /**
   * Returns a serialisable form of this `IAMap` node. The internal representation of this local node is copied into a plain
   * JavaScript `Object` including a representation of its data array that the key/value pairs it contains as well as
   * the identifiers of child nodes.
   * Root nodes (depth==0) contain the full map configuration information, while intermediate and leaf nodes contain only
   * data that cannot be inferred by traversal from a root node that already has this data (hashAlg, bitWidth and bucketSize).
   * The backing store can use this representation to create a suitable serialised form. When loading from the backing store,
   * `IAMap` expects to receive an object with the same layout from which it can instantiate a full `IAMap` object. Where
   * root nodes contain the full set of data and intermediate and leaf nodes contain just the required data.
   * For content addressable backing stores, it is expected that the same data in this serialisable form will always produce
   * the same identifier.
   *
   * Root node form:
   * ```
   * {
   *   hashAlg: string
   *   bitWidth: number
   *   bucketSize: number
   *   map: number
   *   data: Array
   * }
   * ```
   *
   * Intermediate and leaf node form:
   * ```
   * {
   *   map: number
   *   data: Array
   * }
   * ```
   *
   * Where `data` is an array of a mix of either buckets or links:
   *
   * * A bucket is an array of two elements, the first being a `key` of type `Buffer` and the second a `value`
   *   or whatever type has been provided in `set()` operations for this `IAMap`.
   * * A link is an Object with a single key `'link'` whose value is of the type provided by the backing store in
   *   `save()` operations.
   *
   * @returns {Object} An object representing the internal state of this local `IAMap` node, including its links to child nodes
   * if any.
   */
  toSerializable () {
    let r = { map: this.map }
    if (this.depth === 0) {
      r.hashAlg = this.config.hashAlg
      r.bitWidth = this.config.bitWidth
      r.bucketSize = this.config.bucketSize
    }
    r.data = this.data.map((e) => {
      return e.toSerializable()
    })
    return r
  }

  /**
   * Calculate the number of entries locally stored by this node. Performs a scan of local buckets and adds up
   * their size.
   *
   * @returns {number} A number representing the number of local entries.
   */
  directEntryCount () {
    return this.data.reduce((p, c) => {
      return p + (c.bucket ? c.bucket.length : 0)
    }, 0)
  }

  /**
   * Calculate the number of child nodes linked by this node. Performs a scan of the local entries and tallies up the
   * ones containing links to child nodes.
   *
   * @returns {number} A number representing the number of direct child nodes
   */
  directNodeCount () {
    return this.data.reduce((p, c) => {
      return p + (c.link ? 1 : 0)
    }, 0)
  }

  /**
   * Asynchronously perform a check on this node and its children that it is in canonical format for the current data.
   * As this uses `size()` to calculate the total number of entries in this node and its children, it performs a full
   * scan of nodes and therefore incurs a load and deserialisation cost for each child node.
   * A `false` result from this method suggests a flaw in the implemetation.
   *
   * @async
   * @returns {Promise<boolean>} A Promise with a boolean value indicating whether this IAMap is correctly formatted.
   */
  async isInvariant () {
    let size = await this.size()
    let entryArity = this.directEntryCount()
    let nodeArity = this.directNodeCount()
    let arity = entryArity + nodeArity
    let sizePredicate = 2 // 2 == 'more than one'
    if (nodeArity === 0) {
      sizePredicate = Math.min(2, entryArity) // 0, 1 or 2=='more than one'
    }

    let inv1 = size - entryArity >= 2 * (arity - entryArity)
    let inv2 = arity === 0 ? sizePredicate === 0 : true
    let inv3 = (arity === 1 && entryArity === 1) ? sizePredicate === 1 : true
    let inv4 = arity >= 2 ? sizePredicate === 2 : true
    let inv5 = nodeArity >= 0 && entryArity >= 0 && ((entryArity + nodeArity) === arity)

    return inv1 && inv2 && inv3 && inv4 && inv5
  }

  /**
   * A convenience shortcut to {@link IAMap.fromSerializable} that uses this IAMap node instance's backing `store` and
   * configuration `options`. Intended to be used to instantiate child IAMap nodes from a root IAMap node.
   *
   * @param {Object} store A backing store for this Map. See {@link IAMap.create}.
   * @param {Object} id An optional ID for the instantiated IAMap node. See {@link IAMap.fromSerializable}.
   * @param {Object} serializable The serializable form of an IAMap node to be instantiated.
   * @param {number} [depth=0] The depth of the IAMap node. See {@link IAMap.fromSerializable}.
  */
  fromChildSerializable (id, serializable, depth) {
    return fromSerializable(this.store, id, serializable, this.config, depth)
  }
}

// store a new node and assign it an ID
async function save (store, newNode) {
  let id = await store.save(newNode.toSerializable())
  ro(newNode, 'id', id)
  return newNode
}

// utility function to avoid duplication since it's used across get(), set() and delete()
/*
{ bucket: { found: true, elementAt, element, bucketIndex, bucketEntry } }
{ bucket: { found: false, elementAt, element } }
{ link: { elementAt, element } }
*/
function findElement (node, bitpos, key) {
  let elementAt = index(node.map, bitpos)
  let element = node.data[elementAt]
  assert(element)
  if (element.bucket) { // data element
    for (let bucketIndex = 0; bucketIndex < element.bucket.length; bucketIndex++) {
      let bucketEntry = element.bucket[bucketIndex]
      if (bucketEntry.key.equals(key)) {
        return { data: { found: true, elementAt, element, bucketIndex, bucketEntry } }
      }
    }
    return { data: { found: false, elementAt, element } }
  }
  assert(element.link)
  return { link: { elementAt, element } }
}

// new element for this node, i.e. first time this hash portion has been seen here
async function addNewElement (node, bitpos, key, value) {
  let insertAt = index(node.map, bitpos)
  let newData = node.data.slice()
  newData.splice(insertAt, 0, new Element([ new KV(key, value) ]))
  let newMap = setBit(node.map, bitpos, 1)
  return create(node.store, node.config, newMap, node.depth, newData)
}

// update an existing bucket with a new k/v pair
async function updateBucket (node, elementAt, bucketAt, key, value) {
  let oldElement = node.data[elementAt]
  let newElement = new Element(oldElement.bucket.slice())
  let newKv = new KV(key, value)
  if (bucketAt === -1) {
    newElement.bucket.push(newKv)
    // in-bucket sort is required to maintain a canonical state
    newElement.bucket.sort((a, b) => Buffer.compare(a.key, b.key))
  } else {
    newElement.bucket[bucketAt] = newKv
  }
  let newData = node.data.slice()
  newData[elementAt] = newElement
  return create(node.store, node.config, node.map, node.depth, newData)
}

// overflow of a bucket means it has to be replaced with a child node, tricky surgery
async function replaceBucketWithNode (node, bitpos, elementAt) {
  let newNode = new IAMap(node.store, node.config, 0, node.depth + 1)
  let element = node.data[elementAt]
  assert(element)
  assert(element.bucket)
  for (let c of element.bucket) {
    newNode = await newNode.set(c.key, c.value)
  }
  newNode = await save(node.store, newNode)
  let newData = node.data.slice()
  newData[elementAt] = new Element(null, newNode.id)
  return create(node.store, node.config, node.map, node.depth, newData)
}

// similar to addNewElement() but for new child nodes
async function updateNode (node, elementAt, key, newChild) {
  assert(newChild.id)
  let newElement = new Element(null, newChild.id)
  let newData = node.data.slice()
  newData[elementAt] = newElement
  return create(node.store, node.config, node.map, node.depth, newData)
}

// take a node, extract all of its local entries and put them into a new node with a single
// bucket; used for collapsing a node and sending it upward
function collapseIntoSingleBucket (node, hash, elementAt, bucketIndex) {
  // pretend it's depth=0 (it may end up being) and only 1 bucket
  let newMap = setBit(0, mask(hash, 0, node.config.bitWidth), 1)
  let newBucket = node.data.reduce((p, c, i) => {
    if (i === elementAt) {
      if (c.bucket.length === 1) { // only element in bucket, skip it
        return p
      } else {
        // there's more in this bucket, make a temporary one, remove it and concat it
        let tmpBucket = c.bucket.slice()
        tmpBucket.splice(bucketIndex, 1)
        return p.concat(tmpBucket)
      }
    } else {
      return p.concat(c.bucket)
    }
  }, [])
  newBucket.sort((a, b) => Buffer.compare(a.key, b.key))
  let newElement = new Element(newBucket)
  return create(node.store, node.config, newMap, 0, [ newElement ])
}

// simple delete from an existing bucket in this node
function removeFromBucket (data, bitpos, elementAt, lastInBucket, bucketIndex) {
  let newData = data.slice()
  if (!lastInBucket) {
    // bucket will not be empty, remove only the element from it
    let oldElement = data[elementAt]
    let newElement = new Element(oldElement.bucket.slice())
    newElement.bucket.splice(bucketIndex, 1)
    newData.splice(elementAt, 1, newElement) // replace old bucket
  } else {
    // empty bucket, just remove it
    newData.splice(elementAt, 1)
  }
  return newData
}

// a node has bubbled up from a recursive delete() and we need to extract its
// contents and insert it into ours
async function collapseNodeInline (node, bitpos, newNode) {
  // assume the newNode has a single bucket and it's sorted and ready to replace the place
  // it had in node's element array
  assert.strictEqual(newNode.data.length, 1)
  assert(newNode.data[0].bucket)
  let newBucket = newNode.data[0].bucket.slice()
  let newElement = new Element(newBucket)
  let elementIndex = index(node.map, bitpos)
  let newData = node.data.slice()
  newData[elementIndex] = newElement

  return create(node.store, node.config, node.map, node.depth, newData)
}

function buildConfig (options) {
  let config = {}

  if (!options) {
    throw new TypeError('Invalid `options` object')
  }

  if (typeof options.hashAlg !== 'string') {
    throw new TypeError('Invalid `hashAlg` option')
  }
  if (!hasherRegistry[options.hashAlg]) {
    throw new TypeError(`Unknown hashAlg: '${options.hashAlg}'`)
  }
  ro(config, 'hashAlg', options.hashAlg)

  if (typeof options.bitWidth === 'number') {
    if (options.bitWidth <= 1 || options.bitWidth > 8) {
      throw new TypeError('Invalid `bitWidth` option')
    }
    ro(config, 'bitWidth', options.bitWidth)
  } else if (options.bitWidth !== undefined) {
    throw new TypeError('Invalid `bitWidth` option')
  } else {
    ro(config, 'bitWidth', defaultBitWidth)
  }

  if (typeof options.bucketSize === 'number') {
    if (options.bucketSize < 2) {
      throw new TypeError('Invalid `bucketSize` option')
    }
    ro(config, 'bucketSize', options.bucketSize)
  } else if (options.bucketSize !== undefined) {
    throw new TypeError('Invalid `bucketSize` option')
  } else {
    ro(config, 'bucketSize', defaultBucketSize)
  }

  return config
}

/* istanbul ignore next */
const dummyStore = { load () {}, save () {} }

/**
 * Perform a single-block synchronous traversal. Takes a root block, and a second block (either the
 * root block or a child block), the depth of the second block in relation to the root, the key
 * being looked up and an `isEqual()` for comparing identifiers. Performs the single-node traversal
 * algorithm and halts if the value being looked up is contained within that block or if a child
 * block is required to traverse further. It is up to the user to perform additional traversals on
 * child blocks when they are available.
 *
 * @name IAMap.traverse
 * @function
 * @param {Object} rootBlock The root block, for extracting the IAMap configuration data
 * @param {Object} currentBlock The block currently being traversed. This may either be the root block
 * itself (for the start of a traversal) or any child block within the IAMap structure.
 * @param {number} depth The distance from the root block, since child blocks don't contain their
 * depth information and we lose it when not performing a full recursive traversal.
 * @param {string|array|Buffer|ArrayBuffer} key - A key to remove. See {@link IAMap#set} for details about
 * acceptable `key` types.
 * @param {function} isEqual A function that compares two identifiers in the data store. See
 * {@link IAMap.create} for details on the backing store and the requirements of an `isEqual()` function.
 * @returns {Object} The returned object is of the form `{ value, nextId }` where one of these properties
 * may be non-null. If the `nextId` is non-null, a further traversal is required on a child block
 * identified by `nextId` with a depth 1 greater than the current depth. Where `nextId` is `null`,
 * `value` will either be `null` or a value found within the current block.
 */
function traverse (rootBlock, currentBlock, depth, key, isEqual) {
  if (!Buffer.isBuffer(key)) {
    key = Buffer.from(key)
  }
  const store = Object.assign(dummyStore, { isEqual })
  const node = IAMap.isIAMap(currentBlock)
    ? currentBlock
    : fromSerializable(store, 0, currentBlock, rootBlock, depth)
  const hash = hasherRegistry[node.config.hashAlg].hasher(key)
  assert(Buffer.isBuffer(hash))
  const bitpos = mask(hash, depth, node.config.bitWidth)

  if (bitmapHas(node.map, bitpos)) {
    let { data, link } = findElement(node, bitpos, key)
    if (data) {
      return { value: data.found ? data.bucketEntry.value : null, nextId: null }
    } else { // link
      return { value: null, nextId: link.element.link }
    }
  } else { // we don't have an element for this hash portion
    return { value: null, nextId: null }
  }
}

/**
 * Determine if a serializable object is an IAMap root type, can be used to assert whether a data block is
 * an IAMap before trying to instantiate it.
 *
 * @name IAMap.isRootSerializable
 * @function
 * @param {Object} serializable An object that may be a serialisable form of an IAMap root node
 * @returns {boolean} An indication that the serialisable form is or is not an IAMap root node
 */
function isRootSerializable (serializable) {
  return typeof serializable.hashAlg === 'string' &&
    typeof serializable.bitWidth === 'number' &&
    typeof serializable.bucketSize === 'number'
}

/**
 * Determine if a serializable object is an IAMap node type, can be used to assert whether a data block is
 * an IAMap node before trying to instantiate it.
 * This should pass for both root nodes as well as child nodes
 *
 * @name IAMap.isSerializable
 * @function
 * @param {Object} serializable An object that may be a serialisable form of an IAMap node
 * @returns {boolean} An indication that the serialisable form is or is not an IAMap node
 */
function isSerializable (serializable) {
  return Array.isArray(serializable.data) && typeof serializable.map === 'number'
}

/**
 * Instantiate an IAMap from a valid serialisable form of an IAMap node. The serializable should be the same as
 * produced by {@link IAMap#toSerializable}.
 * Serialised forms of root nodes must satisfy both {@link IAMap.isRootSerializable} and {@link IAMap.isSerializable}. For
 * root nodes, the `options` parameter will be ignored and the `depth` parameter must be the default value of `0`.
 * Serialised forms of non-root nodes must satisfy {@link IAMap.isSerializable} and have a valid `options` parameter and
 * a non-`0` `depth` parameter.
 *
 * @name IAMap.fromSerializable
 * @function
 * @param {Object} store A backing store for this Map. See {@link IAMap.create}.
 * @param {Object} id An optional ID for the instantiated IAMap node. Unlike {@link IAMap.create},
 * `fromSerializable()` does not `save()` a newly created IAMap node so an ID is not generated for it. If one is
 * required for downstream purposes it should be provided, if the value is `null` or `undefined`, `node.id` will
 * be `null` but will remain writable.
 * @param {Object} serializable The serializable form of an IAMap node to be instantiated
 * @param {Object} [options=null] An options object for IAMap child node instantiation. Will be ignored for root
 * node instantiation (where `depth` = `0`) See {@link IAMap.create}.
 * @param {number} [depth=0] The depth of the IAMap node. Where `0` is the root node and any `>0` number is a child
 * node.
 */
function fromSerializable (store, id, serializable, options = null, depth = 0) {
  if (depth === 0) { // even if options were supplied, ignore them and use what's in the serializable
    if (!isRootSerializable(serializable)) {
      throw new Error('Object does not appear to be an IAMap root (depth==0)')
    }
    // don't use passed-in options
    options = {
      hashAlg: serializable.hashAlg,
      bitWidth: serializable.bitWidth,
      bucketSize: serializable.bucketSize
    }
  }
  assert(Array.isArray(serializable.data))
  let data = serializable.data.map(Element.fromSerializable)
  let node = new IAMap(store, options, serializable.map, depth, data)
  if (id != null) {
    ro(node, 'id', id)
  }
  return node
}

IAMap.isIAMap = function isIAMap (node) {
  return node instanceof IAMap
}

function ro (obj, prop, value) {
  Object.defineProperty(obj, prop, { value: value, writable: false, enumerable: true })
}

// internal utility to fetch a map instance's hash function
function hasher (map) {
  return hasherRegistry[map.config.hashAlg].hasher
}

module.exports.create = create
module.exports.load = load
module.exports.registerHasher = registerHasher
module.exports.traverse = traverse
module.exports.fromSerializable = fromSerializable
module.exports.isSerializable = isSerializable
module.exports.isRootSerializable = isRootSerializable

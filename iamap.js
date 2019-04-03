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
 * @param {string} options.codec - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv)
 * hash function identifier, e.g. `'murmur3-32'`. Hash functions must be registered with {@link IAMap.registerHasher}.
 * @param {number} [options.bitWidth=5] - The number of bits to extract from the hash to form an element index at
 * each level of the Map, e.g. a bitWidth of 5 will extract 5 bits to be used as the element index, since 2^5=32,
 * each node will store up to 32 elements (child nodes and/or entry buckets). The maximum depth of the Map is
 * determined by `floor((hashBytes * 8) / bitWidth)` where `hashBytes` is the number of bytes the hash function
 * produces, e.g. `hashBytes=32` and `bitWidth=5` yields a maximum depth of 51 nodes. The maximum `bitWidth`
 * currently allowed is `8` which will store 256 elements in each node.
 * @param {number} [options.bucketSize=8] - The maximum number of collisions acceptable at each level of the Map. A
 * collision in the `bitWidth` index at a given depth will result in entries stored in a bucket (array). Once the
 * bucket exceeds `bucketSize`, a new child node is created for that index and all entries in the bucket are
 * pushed
 */
async function create (store, options, dataMap, nodeMap, depth, elements) {
  // dataMap, nodeMap, depth and elements are intended for internal use
  let newNode = new IAMap(store, options, dataMap, nodeMap, depth, elements)
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
 * @param {Object} store - A backing store for this Map. {@link IAMap.create}.
 * @param id - An content address / ID understood by the backing `store`.
*/
async function load (store, id) {
  let serialized = await store.load(id)
  return IAMap.fromSerializable(id, serialized, store)
}

/**
 * ```js
 * IAMap.registerHasher(codec, hashBytes, hasher)
 * ```
 *
 * Register a new hash function. IAMap has no hash functions by default, at least one is required to create a new
 * IAMap.
 *
 * @name IAMap.registerHasher
 * @function
 * @param {string} codec - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv) hash
 * function identifier, e.g. `'murmur3-32'`.
 * @param {number} hasherBytes - The number of bytes to use from the result of the `hasher()` function (e.g. `32`)
 * @param {function} hasher - A hash function that takes a `Buffer` derived from the `key` values used for this
 * Map and returns a `Buffer` (or a `Buffer`-like, such that each element of the array contains a single byte value).
 */
function registerHasher (codec, hashBytes, hasher) {
  if (!multicodec.codes[codec]) {
    throw new TypeError(`Codec '${codec}' is not in the multicodec database`)
  }
  if (typeof hashBytes !== 'number') {
    throw new TypeError('Invalid `hashBytes`')
  }
  if (typeof hasher !== 'function') {
    throw new TypeError('Invalid `hasher` function }')
  }
  hasherRegistry[codec] = { hashBytes, hasher }
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

// an element in the array of elements that each node holds, each
// element could be either a container of an array (bucket) of KVs
// or a link to a child node
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
    assert.fail('badly formed element')
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
 * @property {string} config.codec - The hash function used by this `IAMap` instance. See {@link IAMap.create} for more
 * details.
 * @property {number} config.bitWidth - The number of bits used at each level of this `IAMap`. See {@link IAMap.create}
 * for more details.
 * @property {number} config.bucketSize - TThe maximum number of collisions acceptable at each level of the Map.
 * @property {number} [dataMap=0] - Bitmap indicating which slots are occupied by data entries, each data entry
 * contains an bucket of entries
 * @property {number} [nodeMap=0] - Bitmap indicating which slots are occupied by child nodes
 * @property {number} [depth=0] - Depth of the current node in the IAMap, `depth` is used to extract bits from the
 * key hashes to locate slots
 * @property {Array} [elements=[]] - Array of elements (an internal `Element` type), each of which contains a
 * bucket of entries or an ID of a child node
 * See {@link IAMap.create} for more details.
 */
class IAMap {
  /**
   * @ignore
   * @private
   */
  constructor (store, options, dataMap, nodeMap, depth, elements) {
    if (!store || typeof store.save !== 'function' ||
        typeof store.load !== 'function' ||
        typeof store.isEqual !== 'function') {
      throw new TypeError('Invalid `store` option, must be of type: { save(node):id, load(id):node, isEqual(id,id):boolean }')
    }
    ro(this, 'store', store)

    this.id = null
    let config = {}
    ro(this, 'config', config)

    if (!options) {
      throw new TypeError('Invalid `options` object')
    }

    if (typeof options.codec !== 'string') {
      throw new TypeError('Invalid `codec` option')
    }
    if (!hasherRegistry[options.codec]) {
      throw new TypeError(`Unknown codec: '${options.codec}'`)
    }
    ro(config, 'codec', options.codec)
    let hashBytes = hasherRegistry[options.codec].hashBytes

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

    if (dataMap !== undefined && typeof dataMap !== 'number') {
      throw new TypeError('`dataMap` must be a Number')
    }
    ro(this, 'dataMap', dataMap || 0)

    if (nodeMap !== undefined && typeof nodeMap !== 'number') {
      throw new TypeError('`nodeMap` must be a Number')
    }
    ro(this, 'nodeMap', nodeMap || 0)

    if (depth !== undefined && typeof depth !== 'number') {
      throw new TypeError('`depth` must be a Number')
    }
    ro(this, 'depth', depth || 0)
    if (this.depth > Math.floor((hashBytes * 8) / this.config.bitWidth)) {
      // our hasher only has `hashBytes` to work with and we take off `bitWidth` bits with each level
      // e.g. 32-byte hash gives us a maximum depth of 51 levels
      throw new Error('Overflow: maximum tree depth reached')
    }

    ro(this, 'elements', Object.freeze(elements || []))
    for (let e of this.elements) {
      if (!(e instanceof Element)) {
        throw new TypeError('`elements` array must contain only `Element` types')
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

    if (bitmapHas(this.dataMap, bitpos)) { // should be in a bucket in this node
      return findDataElement(this, bitpos, key, async (found, elementAt, element, bucketIndex, bucketEntry) => {
        if (found) {
          if (bucketEntry.value === value) {
            return this // no change, identical value
          }
          // replace entry for this key with a new value
          // note that === will fail for two complex objects representing the same data so we may end up
          // with a node of the same ID anyway
          return updateBucket(this, elementAt, bucketIndex, key, value)
        } else {
          if (element.bucket.length >= this.config.bucketSize) {
            // too many collisions at this level, replace a bucket with a child node
            return (await replaceBucketWithNode(this, bitpos, elementAt)).set(key, value)
          }
          // insert into the bucket and sort it
          return updateBucket(this, elementAt, -1, key, value)
        }
      })
    } else if (bitmapHas(this.nodeMap, bitpos)) { // should be in a child node
      return findNodeElement(this, bitpos, async (elementAt, element) => {
        let child = await load(this.store, element.link)
        assert(child)
        let newChild = await child.set(key, value)
        return updateNode(this, elementAt, key, newChild)
      })
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
    if (!Buffer.isBuffer(key)) {
      key = Buffer.from(key)
    }
    const hash = hasher(this)(key)
    assert(Buffer.isBuffer(hash))
    const bitpos = mask(hash, this.depth, this.config.bitWidth)

    if (bitmapHas(this.dataMap, bitpos)) { // should be in a bucket in this node
      return findDataElement(this, bitpos, key, async (found, elementAt, element, bucketIndex, bucketEntry) => {
        return found ? bucketEntry.value : null
      })
    } else if (bitmapHas(this.nodeMap, bitpos)) { // should be in a child node
      return findNodeElement(this, bitpos, async (elementAt, element) => {
        let child = await load(this.store, element.link)
        assert(child)
        return child.get(key)
      })
    } else { // we don't have an element for this hash portion
      return null
    }
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

    if (bitmapHas(this.dataMap, bitpos)) { // should be in a bucket in this node
      return findDataElement(this, bitpos, key, async (found, elementAt, element, bucketIndex, bucketEntry) => {
        if (found) {
          if (this.depth !== 0 && this.directNodeCount() === 0 && this.directEntryCount() === this.config.bucketSize + 1) {
            // current node will only have this.config.bucketSize entries spread across its buckets
            // and no child nodes, so wrap up the remaining nodes in a fresh IAMap at depth 0, it will
            // bubble up to either become the new root node or be unpacked by a higher level
            return collapseIntoSingleBucket(this, hash, elementAt, bucketIndex)
          } else {
            // we'll either have more entries left than this.config.bucketSize or we're at the root node
            // so this is a simple bucket removal, no collapsing needed (root nodes can't be collapsed)
            let lastInBucket = this.elements.length === 1
            // we have at least one child node or too many entries in buckets to be collapsed
            let newElements = removeFromBucket(this.elements, bitpos, elementAt, lastInBucket, bucketIndex)
            let newDataMap = this.dataMap
            if (lastInBucket) {
              newDataMap = setBit(newDataMap, bitpos, 0)
            }
            return create(this.store, this.config, newDataMap, this.nodeMap, this.depth, newElements)
          }
        } else {
          // key would be located here according to hash, but we don't have it
          return this
        }
      })
    } else if (bitmapHas(this.nodeMap, bitpos)) { // should be in a child node
      return findNodeElement(this, bitpos, async (elementAt, element) => {
        let child = await load(this.store, element.link)
        assert(child)
        let newChild = await child.delete(key)
        if (this.store.isEqual(newChild.id, element.link)) { // no modification
          return this
        }

        assert(newChild.elements.length > 0) // something probably went wrong in the dataMap block above

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
          return updateNode(this, elementAt, key, newChild)
        }
      })
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
    for (let e of this.elements) {
      if (e.bucket) {
        c += e.bucket.length
      } else {
        let child = await load(this.store, e.link)
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
    for (let e of this.elements) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield kv.key
        }
      } else {
        let child = await load(this.store, e.link)
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
    for (let e of this.elements) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield kv.value
        }
      } else {
        let child = await load(this.store, e.link)
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
    for (let e of this.elements) {
      if (e.bucket) {
        for (let kv of e.bucket) {
          yield { key: kv.key, value: kv.value }
        }
      } else {
        let child = await load(this.store, e.link)
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
    for (let e of this.elements) {
      if (e.link) {
        let child = await load(this.store, e.link)
        yield * child.ids()
      }
    }
  }

  /**
   * Returns a serialisable form of this `IAMap` node. The internal representation of this local node is copied into a plain
   * JavaScript `Object` including a representation of its elements array that the key/value pairs it contains as well as
   * the identifiers of child nodes.
   * The backing store can use this representation to create a suitable serialised form. When loading from the backing store,
   * `IAMap` expects to receive an object with the same layout from which it can instantiate a full `IAMap` object.
   * For content addressable backing stores, it is expected that the same data in this serialisable form will always produce
   * the same identifier.
   *
   * ```
   * {
   *   codec: Buffer
   *   bitWidth: number
   *   bucketSize: number
   *   depth: number
   *   dataMap: number
   *   nodeMap: number
   *   elements: Array
   * }
   * ```
   *
   * Where `elements` is an array of a mix of either buckets or links:
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
    let r = {
      codec: multicodec.codes[this.config.codec],
      bitWidth: this.config.bitWidth,
      bucketSize: this.config.bucketSize,
      depth: this.depth,
      dataMap: this.dataMap,
      nodeMap: this.nodeMap
    }
    r.elements = this.elements.map((e) => {
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
    return this.elements.reduce((p, c) => {
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
    return this.elements.reduce((p, c) => {
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
}

// store a new node and assign it an ID
async function save (store, newNode) {
  let id = await store.save(newNode.toSerializable())
  ro(newNode, 'id', id)
  return newNode
}

// utility function to avoid duplication since it's used across get(), set() and delete()
async function findDataElement (node, bitpos, key, onFound) {
  let elementAt = index(node.dataMap, bitpos)
  let element = node.elements[elementAt]
  assert(element)
  assert(element.bucket)
  for (let bucketIndex = 0; bucketIndex < element.bucket.length; bucketIndex++) {
    let bucketEntry = element.bucket[bucketIndex]
    if (bucketEntry.key.equals(key)) {
      return onFound(true, elementAt, element, bucketIndex, bucketEntry)
    }
  }
  return onFound(false, elementAt, element)
}

// child node indexes are more complicated than bucket indexes, in our elements array
// buckets are at the start in order, so index(this.dataMap, bitpos) works fine for them
// nodes go at the end in CHAMP, so we need index from the end (i.e. in reverse)
function nodeIndex (nodeMap, elements, bitpos) {
  return elements.length - 1 - index(nodeMap, bitpos)
}

// very simple utility function to avoid duplication
async function findNodeElement (node, bitpos, onFound) {
  let elementAt = nodeIndex(node.nodeMap, node.elements, bitpos)
  let element = node.elements[elementAt]
  assert(element)
  assert(element.link)
  return onFound(elementAt, element)
}

// new element for this node, i.e. first time this hash portion has been seen here
async function addNewElement (node, bitpos, key, value) {
  let insertAt = index(node.dataMap, bitpos)
  let newElements = node.elements.slice()
  newElements.splice(insertAt, 0, new Element([ new KV(key, value) ]))
  let newDataMap = setBit(node.dataMap, bitpos, 1)
  return create(node.store, node.config, newDataMap, node.nodeMap, node.depth, newElements)
}

// update an existing bucket with a new k/v pair
async function updateBucket (node, elementAt, bucketAt, key, value) {
  let oldElement = node.elements[elementAt]
  let newElement = new Element(oldElement.bucket.slice())
  let newKv = new KV(key, value)
  if (bucketAt === -1) {
    newElement.bucket.push(newKv)
    // in-bucket sort is required to maintain a canonical state
    newElement.bucket.sort((a, b) => Buffer.compare(a.key, b.key))
  } else {
    newElement.bucket[bucketAt] = newKv
  }
  let newElements = node.elements.slice()
  newElements[elementAt] = newElement
  return create(node.store, node.config, node.dataMap, node.nodeMap, node.depth, newElements)
}

// overflow of a bucket means it has to be replaced with a child node, tricky surgery
async function replaceBucketWithNode (node, bitpos, elementAt) {
  let newNode = new IAMap(node.store, node.config, 0, 0, node.depth + 1)
  let element = node.elements[elementAt]
  assert(element)
  assert(element.bucket)
  for (let c of element.bucket) {
    newNode = await newNode.set(c.key, c.value)
  }
  newNode = await save(node.store, newNode)

  let newElements = node.elements.slice()
  newElements.splice(elementAt, 1) // delete
  let newDataMap = setBit(node.dataMap, bitpos, 0)
  assert(!bitmapHas(newDataMap, bitpos))

  assert(!bitmapHas(node.nodeMap, bitpos))
  let newNodeMap = setBit(node.nodeMap, bitpos, 1)
  assert(bitmapHas(newNodeMap, bitpos))
  // see nodeIndex() for why we index from the right
  let insertAt = newElements.length - index(newNodeMap, bitpos)
  newElements.splice(insertAt, 0, new Element(null, newNode.id))

  return create(node.store, node.config, newDataMap, newNodeMap, node.depth, newElements)
}

// similar to addNewElement() but for new child nodes
async function updateNode (node, elementAt, key, newChild) {
  assert(newChild.id)
  let newElement = new Element(null, newChild.id)
  let newElements = node.elements.slice()
  newElements[elementAt] = newElement
  return create(node.store, node.config, node.dataMap, node.nodeMap, node.depth, newElements)
}

// take a node, extract all of its local entries and put them into a new node with a single
// bucket; used for collapsing a node and sending it upward
function collapseIntoSingleBucket (node, hash, elementAt, bucketIndex) {
  // pretend it's depth=0 (it may end up being) and only 1 bucket
  let newDataMap = setBit(0, mask(hash, 0, node.config.bitWidth), 1)
  let newBucket = node.elements.reduce((p, c, i) => {
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
  return create(node.store, node.config, newDataMap, 0, 0, [ newElement ])
}

// simple delete from an existing bucket in this node
function removeFromBucket (elements, bitpos, elementAt, lastInBucket, bucketIndex) {
  let newElements = elements.slice()
  if (!lastInBucket) {
    // bucket will not be empty, remove only the element from it
    let oldElement = elements[elementAt]
    let newElement = new Element(oldElement.bucket.slice())
    newElement.bucket.splice(bucketIndex, 1)
    newElements.splice(elementAt, 1, newElement) // replace old bucket
  } else {
    // empty bucket, just remove it
    newElements.splice(elementAt, 1)
  }
  return newElements
}

// a node has bubbled up from a recursive delete() and we need to extract its
// contents and insert it into ours
async function collapseNodeInline (node, bitpos, newNode) {
  // assume the newNode has a single bucket and it's sorted and ready to replace the place
  // it had in node's element array
  assert.strictEqual(newNode.elements.length, 1)
  assert(newNode.elements[0].bucket)
  let newBucket = newNode.elements[0].bucket.slice()
  let newElement = new Element(newBucket)

  let oldIndex = nodeIndex(node.nodeMap, node.elements, bitpos)
  let newIndex = index(node.dataMap, bitpos)
  assert(oldIndex >= newIndex)
  let newElements = node.elements.slice()
  newElements.splice(oldIndex, 1) // remove old node
  newElements.splice(newIndex, 0, newElement)

  let newDataMap = node.dataMap
  newDataMap = setBit(newDataMap, bitpos, 1)
  let newNodeMap = node.nodeMap
  newNodeMap = setBit(newNodeMap, bitpos, 0)
  return create(node.store, node.config, newDataMap, newNodeMap, node.depth, newElements)
}

// MUST be symmetrical with IAMap#toSerializable()
IAMap.fromSerializable = function (id, obj, store) {
  assert(Buffer.isBuffer(obj.codec))
  let options = {
    codec: multicodec.names[obj.codec.toString('hex')],
    bitWidth: obj.bitWidth,
    bucketSize: obj.bucketSize
  }
  assert(Array.isArray(obj.elements))
  let elements = obj.elements.map(Element.fromSerializable)
  let node = new IAMap(store, options, obj.dataMap, obj.nodeMap, obj.depth, elements)
  ro(node, 'id', id)
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
  return hasherRegistry[map.config.codec].hasher
}

module.exports.create = create
module.exports.load = load
module.exports.registerHasher = registerHasher

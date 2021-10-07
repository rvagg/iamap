
// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

const { mask, setBit, bitmapHas, index } = require('./bit-utils')

const defaultBitWidth = 8 // 2^8 = 256 buckets or children per node
const defaultBucketSize = 5 // array size for a bucket of values

/**
 * @template T
 * @typedef {import('./interface').Store<T>} Store<T>
 */
/**
 * @typedef {import('./interface').Config} Config
 * @typedef {import('./interface').Options} Options
 * @typedef {import('./interface').SerializedKV} SerializedKV
 * @typedef {import('./interface').SerializedElement} SerializedElement
 * @typedef {import('./interface').SerializedNode} SerializedNode
 * @typedef {import('./interface').SerializedRoot} SerializedRoot
 * @typedef {import('./interface').AbortOptions} AbortOptions
 * @typedef {(inp:Uint8Array)=>(Uint8Array|Promise<Uint8Array>)} Hasher
 * @typedef {{ hasher: Hasher, hashBytes: number }[]} Registry
 * @typedef {(link:any)=>boolean} IsLink
 * @typedef {readonly Element[]} ReadonlyElement
 * @typedef {{data?: { found: boolean, elementAt: number, element: Element, bucketIndex?: number, bucketEntry?: KV }, link?: { elementAt: number, element: Element }}} FoundElement
 */

/**
 * @type {Registry}
 * @ignore
 */
const hasherRegistry = []

const textEncoder = new TextEncoder()

/**
 * @ignore
 * @param {boolean} condition
 * @param {string} [message]
 */
function assert (condition, message) {
  if (!condition) {
    throw new Error(message || 'Unexpected error')
  }
}

/**
 * ```js
 * let map = await iamap.create(store, options)
 * ```
 *
 * Create a new IAMap instance with a backing store. This operation is asynchronous and returns a `Promise` that
 * resolves to a `IAMap` instance.
 *
 * @name iamap.create
 * @function
 * @async
 * @template T
 * @param {Store<T>} store - A backing store for this Map. The store should be able to save and load a serialised
 * form of a single node of a IAMap which is provided as a plain object representation. `store.save(node)` takes
 * a serialisable node and should return a content address / ID for the node. `store.load(id)` serves the inverse
 * purpose, taking a content address / ID as provided by a `save()` operation and returning the serialised form
 * of a node which can be instantiated by IAMap. In addition, two identifier handling methods are needed:
 * `store.isEqual(id1, id2)` is required to check the equality of the two content addresses / IDs
 * (which may be custom for that data type). `store.isLink(obj)` is used to determine if an object is a link type
 * that can be used for `load()` operations on the store. It is important that link types be different to standard
 * JavaScript arrays and don't share properties used by the serialized form of an IAMap (e.g. such that a
 * `typeof obj === 'object' && Array.isArray(obj.data)`) .This is because a node data element may either be a link to
 * a child node, or an inlined child node, so `isLink()` should be able to determine if an object is a link, and if not,
 * `Array.isArray(obj)` will determine if that data element is a bucket of elements, or the above object check be able
 * to determine that an inline child node exists at the data element.
 * The `store` object should take the following form:
 * `{ async save(node):id, async load(id):node, isEqual(id,id):boolean, isLink(obj):boolean }`
 * A `store` should throw an appropriately informative error when a node that is requested does not exist in the backing
 * store.
 *
 * Options:
 *   - hashAlg (number) - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv)
 *     hash function identifier, e.g. `0x23` for `murmur3-32`. Hash functions must be registered with {@link iamap.registerHasher}.
 *   - bitWidth (number, default 8) - The number of bits to extract from the hash to form a data element index at
 *     each level of the Map, e.g. a bitWidth of 5 will extract 5 bits to be used as the data element index, since 2^5=32,
 *     each node will store up to 32 data elements (child nodes and/or entry buckets). The maximum depth of the Map is
 *     determined by `floor((hashBytes * 8) / bitWidth)` where `hashBytes` is the number of bytes the hash function
 *     produces, e.g. `hashBytes=32` and `bitWidth=5` yields a maximum depth of 51 nodes. The maximum `bitWidth`
 *     currently allowed is `8` which will store 256 data elements in each node.
 *   - bucketSize (number, default  5) - The maximum number of collisions acceptable at each level of the Map. A
 *     collision in the `bitWidth` index at a given depth will result in entries stored in a bucket (array). Once the
 *     bucket exceeds `bucketSize`, a new child node is created for that index and all entries in the bucket are
 *     pushed
 *
 * @param {Options} options - Options for this IAMap
 * @param {Uint8Array} [map] - for internal use
 * @param {number} [depth] - for internal use
 * @param {Element[]} [data] - for internal use
 * @param {AbortOptions} [storeOptions] - options for operations with the underlying store
 */
async function create (store, options, map, depth, data, storeOptions) {
  // map, depth and data are intended for internal use
  const newNode = new IAMap(store, options, map, depth, data)
  return save(store, newNode, storeOptions)
}

/**
 * ```js
 * let map = await iamap.load(store, id)
 * ```
 *
 * Create a IAMap instance loaded from a serialised form in a backing store. See {@link iamap.create}.
 *
 * @name iamap.load
 * @function
 * @async
 * @template T
 * @param {Store<T>} store - A backing store for this Map. See {@link iamap.create}.
 * @param {any} id - An content address / ID understood by the backing `store`.
 * @param {number} [depth=0]
 * @param {Options} [options]
 * @param {AbortOptions} [storeOptions]
 */
async function load (store, id, depth = 0, options, storeOptions) {
  // depth and options are internal arguments that the user doesn't need to interact with
  if (depth !== 0 && typeof options !== 'object') {
    throw new Error('Cannot load() without options at depth > 0')
  }
  const serialized = await store.load(id, storeOptions)
  return fromSerializable(store, id, serialized, options, depth)
}

/**
 * ```js
 * iamap.registerHasher(hashAlg, hashBytes, hasher)
 * ```
 *
 * Register a new hash function. IAMap has no hash functions by default, at least one is required to create a new
 * IAMap.
 *
 * @name iamap.registerHasher
 * @function
 * @param {number} hashAlg - A [multicodec](https://github.com/multiformats/multicodec/blob/master/table.csv) hash
 * function identifier **number**, e.g. `0x23` for `murmur3-32`.
 * @param {number} hashBytes - The number of bytes to use from the result of the `hasher()` function (e.g. `32`)
 * @param {Hasher} hasher - A hash function that takes a `Uint8Array` derived from the `key` values used for this
 * Map and returns a `Uint8Array` (or a `Uint8Array`-like, such that each data element of the array contains a single byte value). The function
 * may or may not be asynchronous but will be called with an `await`.
 */
function registerHasher (hashAlg, hashBytes, hasher) {
  if (!Number.isInteger(hashAlg)) {
    throw new Error('Invalid `hashAlg`')
  }
  if (!Number.isInteger(hashBytes)) {
    throw new TypeError('Invalid `hashBytes`')
  }
  if (typeof hasher !== 'function') {
    throw new TypeError('Invalid `hasher` function }')
  }
  hasherRegistry[hashAlg] = { hashBytes, hasher }
}

// simple stable key/value representation
/**
 * @ignore
 */
class KV {
  /**
   * @ignore
   * @param {Uint8Array} key
   * @param {any} value
   */
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  /**
   * @ignore
   * @returns {SerializedKV}
   */
  toSerializable () {
    return [this.key, this.value]
  }
}

/**
 * @ignore
 * @param {SerializedKV} obj
 * @returns {KV}
 */
KV.fromSerializable = function (obj) {
  assert(Array.isArray(obj))
  assert(obj.length === 2)
  return new KV(obj[0], obj[1])
}

// a element in the data array that each node holds, each element could be either a container of
// an array (bucket) of KVs or a link to a child node
class Element {
  /**
   * @ignore
   * @param {KV[]} [bucket]
   * @param {any} [link]
   */
  constructor (bucket, link) {
    this.bucket = bucket || null
    this.link = link !== undefined ? link : null
    assert((this.bucket === null) === (this.link !== null))
  }

  /**
   * @ignore
   * @returns {SerializedElement}
   */
  toSerializable () {
    if (this.bucket) {
      return this.bucket.map((c) => {
        return c.toSerializable()
      })
    } else {
      assert(!IAMap.isIAMap(this.link)) // TODO: inline here
      return this.link
    }
  }
}

/**
 * @ignore
 * @param {IsLink} isLink
 * @param {any} obj
 * @returns {Element}
 */
Element.fromSerializable = function (isLink, obj) {
  if (isLink(obj)) {
    return new Element(undefined, obj)
  } else if (Array.isArray(obj)) {
    return new Element(obj.map(KV.fromSerializable))
  }
  throw new Error('Unexpected error: badly formed data element')
}

/**
 * Immutable Asynchronous Map
 *
 * The `IAMap` constructor should not be used directly. Use `iamap.create()` or `iamap.load()` to instantiate.
 *
 * @class
 * @template T
 * @property {any} id - A unique identifier for this `IAMap` instance. IDs are generated by the backing store and
 * are returned on `save()` operations.
 * @property {number} config.hashAlg - The hash function used by this `IAMap` instance. See {@link iamap.create} for more
 * details.
 * @property {number} config.bitWidth - The number of bits used at each level of this `IAMap`. See {@link iamap.create}
 * for more details.
 * @property {number} config.bucketSize - TThe maximum number of collisions acceptable at each level of the Map.
 * @property {Uint8Array} [map=Uint8Array] - Bitmap indicating which slots are occupied by data entries or child node links,
 * each data entry contains an bucket of entries. Must be the appropriate size for `config.bitWidth`
 * (`2 ** config.bitWith / 8` bytes).
 * @property {number} [depth=0] - Depth of the current node in the IAMap, `depth` is used to extract bits from the
 * key hashes to locate slots
 * @property {Array} [data=[]] - Array of data elements (an internal `Element` type), each of which contains a
 * bucket of entries or an ID of a child node
 * See {@link iamap.create} for more details.
 */
class IAMap {
  /**
   * @ignore
   * @param {Store<T>} store
   * @param {Options} [options]
   * @param {Uint8Array} [map]
   * @param {number} [depth]
   * @param {Element[]} [data]
   */
  constructor (store, options, map, depth, data) {
    if (!store || typeof store.save !== 'function' ||
        typeof store.load !== 'function' ||
        typeof store.isLink !== 'function' ||
        typeof store.isEqual !== 'function') {
      throw new TypeError('Invalid `store` option, must be of type: { save(node):id, load(id):node, isEqual(id,id):boolean, isLink(obj):boolean  }')
    }
    this.store = store

    /**
     * @ignore
     * @type {any|null}
     */
    this.id = null
    this.config = buildConfig(options)

    const hashBytes = hasherRegistry[this.config.hashAlg].hashBytes

    if (map !== undefined && !(map instanceof Uint8Array)) {
      throw new TypeError('`map` must be a Uint8Array')
    }
    const mapLength = Math.ceil(Math.pow(2, this.config.bitWidth) / 8)
    if (map !== undefined && map.length !== mapLength) {
      throw new Error('`map` must be a Uint8Array of length ' + mapLength)
    }
    this.map = map || new Uint8Array(mapLength)

    if (depth !== undefined && (!Number.isInteger(depth) || depth < 0)) {
      throw new TypeError('`depth` must be an integer >= 0')
    }
    this.depth = depth || 0
    if (this.depth > Math.floor((hashBytes * 8) / this.config.bitWidth)) {
      // our hasher only has `hashBytes` to work with and we take off `bitWidth` bits with each level
      // e.g. 32-byte hash gives us a maximum depth of 51 levels
      throw new Error('Overflow: maximum tree depth reached')
    }

    /**
     * @ignore
     * @type {ReadonlyElement}
     */
    this.data = Object.freeze(data || [])
    for (const e of this.data) {
      if (!(e instanceof Element)) {
        throw new TypeError('`data` array must contain only `Element` types')
      }
    }
  }

  /**
   * Asynchronously create a new `IAMap` instance identical to this one but with `key` set to `value`.
   *
   * @param {(string|Uint8Array)} key - A key for the `value` being set whereby that same `value` may
   * be retrieved with a `get()` operation with the same `key`. The type of the `key` object should either be a
   * `Uint8Array` or be convertable to a `Uint8Array` via `TextEncoder.
   * @param {any} value - Any value that can be stored in the backing store. A value could be a serialisable object
   * or an address or content address or other kind of link to the actual value.
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @param {Uint8Array} [_cachedHash] - for internal use
   * @returns {Promise<IAMap<T>>} A `Promise` containing a new `IAMap` that contains the new key/value pair.
   * @async
   */
  async set (key, value, options, _cachedHash) {
    if (!(key instanceof Uint8Array)) {
      key = textEncoder.encode(key)
    }
    const hash = _cachedHash instanceof Uint8Array ? _cachedHash : await hasher(this)(key)
    const bitpos = mask(hash, this.depth, this.config.bitWidth)

    if (bitmapHas(this.map, bitpos)) { // should be in a bucket in this node
      const { data, link } = findElement(this, bitpos, key)
      if (data) {
        if (data.found) {
          /* c8 ignore next 3 */
          if (data.bucketIndex === undefined || data.bucketEntry === undefined) {
            throw new Error('Unexpected error')
          }
          if (data.bucketEntry.value === value) {
            return this // no change, identical value
          }
          // replace entry for this key with a new value
          // note that === will fail for two complex objects representing the same data so we may end up
          // with a node of the same ID anyway
          return updateBucket(this, data.elementAt, data.bucketIndex, key, value, options)
        } else {
          /* c8 ignore next 3 */
          if (!data.element.bucket) {
            throw new Error('Unexpected error')
          }
          if (data.element.bucket.length >= this.config.bucketSize) {
            // too many collisions at this level, replace a bucket with a child node
            return (await replaceBucketWithNode(this, data.elementAt, options)).set(key, value, options, hash)
          }
          // insert into the bucket and sort it
          return updateBucket(this, data.elementAt, -1, key, value, options)
        }
      } else if (link) {
        const child = await load(this.store, link.element.link, this.depth + 1, this.config, options)
        assert(!!child)
        const newChild = await child.set(key, value, options, hash)
        return updateNode(this, link.elementAt, newChild, options)
      /* c8 ignore next 3 */
      } else {
        throw new Error('Unexpected error')
      }
    } else { // we don't have an element for this hash portion, make one
      return addNewElement(this, bitpos, key, value, options)
    }
  }

  /**
   * Asynchronously find and return a value for the given `key` if it exists within this `IAMap`.
   *
   * @param {string|Uint8Array} key - A key for the value being sought. See {@link IAMap#set} for
   * details about acceptable `key` types.
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @param {Uint8Array} [_cachedHash] - for internal use
   * @returns {Promise<any>} A `Promise` that resolves to the value being sought if that value exists within this `IAMap`. If the
   * key is not found in this `IAMap`, the `Promise` will resolve to `undefined`.
   * @async
   */
  async get (key, options, _cachedHash) {
    if (!(key instanceof Uint8Array)) {
      key = textEncoder.encode(key)
    }
    const hash = _cachedHash instanceof Uint8Array ? _cachedHash : await hasher(this)(key)
    const bitpos = mask(hash, this.depth, this.config.bitWidth)
    if (bitmapHas(this.map, bitpos)) { // should be in a bucket in this node
      const { data, link } = findElement(this, bitpos, key)
      if (data) {
        if (data.found) {
          /* c8 ignore next 3 */
          if (data.bucketIndex === undefined || data.bucketEntry === undefined) {
            throw new Error('Unexpected error')
          }
          return data.bucketEntry.value
        }
        return undefined // not found
      } else if (link) {
        const child = await load(this.store, link.element.link, this.depth + 1, this.config, options)
        assert(!!child)
        return await child.get(key, options, hash)
        /* c8 ignore next 3 */
      } else {
        throw new Error('Unexpected error')
      }
    } else { // we don't have an element for this hash portion, not found
      return undefined
    }

    /*
    const traversal = traverseGet(this, key, this.store.isEqual, this.store.isLink, this.depth)
    while (true) {
      const nextId = traversal.traverse()
      if (!nextId) {
        return traversal.value()
      }
      const child = await this.store.load(nextId)
      assert(!!child)
      traversal.next(child)
    }
    */
  }

  /**
   * Asynchronously find and return a boolean indicating whether the given `key` exists within this `IAMap`
   *
   * @param {string|Uint8Array} key - A key to check for existence within this `IAMap`. See
   * {@link IAMap#set} for details about acceptable `key` types.
   * @returns {Promise<boolean>} A `Promise` that resolves to either `true` or `false` depending on whether the `key` exists
   * within this `IAMap`.
   * @async
   */
  async has (key) {
    return (await this.get(key)) !== undefined
  }

  /**
   * Asynchronously create a new `IAMap` instance identical to this one but with `key` and its associated
   * value removed. If the `key` does not exist within this `IAMap`, this instance of `IAMap` is returned.
   *
   * @param {string|Uint8Array} key - A key to remove. See {@link IAMap#set} for details about
   * acceptable `key` types.
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @param {Uint8Array} [_cachedHash] - for internal use
   * @returns {Promise<IAMap<T>>} A `Promise` that resolves to a new `IAMap` instance without the given `key` or the same `IAMap`
   * instance if `key` does not exist within it.
   * @async
   */
  async delete (key, options, _cachedHash) {
    if (!(key instanceof Uint8Array)) {
      key = textEncoder.encode(key)
    }
    const hash = _cachedHash instanceof Uint8Array ? _cachedHash : await hasher(this)(key)
    assert(hash instanceof Uint8Array)
    const bitpos = mask(hash, this.depth, this.config.bitWidth)

    if (bitmapHas(this.map, bitpos)) { // should be in a bucket in this node
      const { data, link } = findElement(this, bitpos, key)
      if (data) {
        if (data.found) {
          /* c8 ignore next 3 */
          if (data.bucketIndex === undefined) {
            throw new Error('Unexpected error')
          }
          if (this.depth !== 0 && this.directNodeCount() === 0 && this.directEntryCount() === this.config.bucketSize + 1) {
            // current node will only have this.config.bucketSize entries spread across its buckets
            // and no child nodes, so wrap up the remaining nodes in a fresh IAMap at depth 0, it will
            // bubble up to either become the new root node or be unpacked by a higher level
            return collapseIntoSingleBucket(this, hash, data.elementAt, data.bucketIndex, options)
          } else {
            // we'll either have more entries left than this.config.bucketSize or we're at the root node
            // so this is a simple bucket removal, no collapsing needed (root nodes can't be collapsed)
            const lastInBucket = this.data.length === 1
            // we have at least one child node or too many entries in buckets to be collapsed
            const newData = removeFromBucket(this.data, data.elementAt, lastInBucket, data.bucketIndex)
            let newMap = this.map
            if (lastInBucket) {
              newMap = setBit(newMap, bitpos, false)
            }
            return create(this.store, this.config, newMap, this.depth, newData, options)
          }
        } else {
          // key would be located here according to hash, but we don't have it
          return this
        }
      } else if (link) {
        const child = await load(this.store, link.element.link, this.depth + 1, this.config, options)
        assert(!!child)
        const newChild = await child.delete(key, options, hash)
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
            return collapseNodeInline(this, bitpos, newChild, options)
          }
        } else {
          // simple node replacement with edited child
          return updateNode(this, link.elementAt, newChild, options)
        }
        /* c8 ignore next 3 */
      } else {
        throw new Error('Unexpected error')
      }
    } else { // we don't have an element for this hash portion
      return this
    }
  }

  /**
   * Asynchronously count the number of key/value pairs contained within this `IAMap`, including its children.
   *
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @returns {Promise<number>} A `Promise` with a `number` indicating the number of key/value pairs within this `IAMap` instance.
   * @async
   */
  async size (options) {
    let c = 0
    for (const e of this.data) {
      if (e.bucket) {
        c += e.bucket.length
      } else {
        const child = await load(this.store, e.link, this.depth + 1, this.config, options)
        c += await child.size()
      }
    }
    return c
  }

  /**
   * Asynchronously emit all keys that exist within this `IAMap`, including its children. This will cause a full
   * traversal of all nodes.
   *
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @returns {AsyncGenerator<Uint8Array>} An async iterator that yields keys. All keys will be in `Uint8Array` format regardless of which
   * format they were inserted via `set()`.
   * @async
   */
  async * keys (options) {
    for (const e of this.data) {
      if (e.bucket) {
        for (const kv of e.bucket) {
          yield kv.key
        }
      } else {
        const child = await load(this.store, e.link, this.depth + 1, this.config, options)
        yield * child.keys()
      }
    }

    // yield * traverseKV(this, 'keys', this.store.isLink)
  }

  /**
   * Asynchronously emit all values that exist within this `IAMap`, including its children. This will cause a full
   * traversal of all nodes.
   *
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @returns {AsyncGenerator<any>} An async iterator that yields values.
   * @async
   */
  async * values (options) {
    for (const e of this.data) {
      if (e.bucket) {
        for (const kv of e.bucket) {
          yield kv.value
        }
      } else {
        const child = await load(this.store, e.link, this.depth + 1, this.config, options)
        yield * child.values()
      }
    }

    // yield * traverseKV(this, 'values', this.store.isLink)
  }

  /**
   * Asynchronously emit all { key, value } pairs that exist within this `IAMap`, including its children. This will
   * cause a full traversal of all nodes.
   *
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @returns {AsyncGenerator<{ key: Uint8Array, value: any}>} An async iterator that yields objects with the properties `key` and `value`.
   * @async
   */
  async * entries (options) {
    for (const e of this.data) {
      if (e.bucket) {
        for (const kv of e.bucket) {
          yield { key: kv.key, value: kv.value }
        }
      } else {
        const child = await load(this.store, e.link, this.depth + 1, this.config, options)
        yield * child.entries()
      }
    }

    // yield * traverseKV(this, 'entries', this.store.isLink)
  }

  /**
   * Asynchronously emit the IDs of this `IAMap` and all of its children.
   *
   * @param {AbortOptions} [options] - options for operations with the underlying store
   * @returns {AsyncGenerator<any>} An async iterator that yields the ID of this `IAMap` and all of its children. The type of ID is
   * determined by the backing store which is responsible for generating IDs upon `save()` operations.
   */
  async * ids (options) {
    yield this.id
    for (const e of this.data) {
      if (e.link) {
        const child = await load(this.store, e.link, this.depth + 1, this.config, options)
        yield * child.ids()
      }
    }
  }

  /**
   * Returns a serialisable form of this `IAMap` node. The internal representation of this local node is copied into a plain
   * JavaScript `Object` including a representation of its data array that the key/value pairs it contains as well as
   * the identifiers of child nodes.
   * Root nodes (depth==0) contain the full map configuration information, while intermediate and leaf nodes contain only
   * data that cannot be inferred by traversal from a root node that already has this data (hashAlg and bucketSize -- bitWidth
   * is inferred by the length of the `map` byte array).
   * The backing store can use this representation to create a suitable serialised form. When loading from the backing store,
   * `IAMap` expects to receive an object with the same layout from which it can instantiate a full `IAMap` object. Where
   * root nodes contain the full set of data and intermediate and leaf nodes contain just the required data.
   * For content addressable backing stores, it is expected that the same data in this serialisable form will always produce
   * the same identifier.
   * Note that the `map` property is a `Uint8Array` so will need special handling for some serialization forms (e.g. JSON).
   *
   * Root node form:
   * ```
   * {
   *   hashAlg: number
   *   bucketSize: number
   *   hamt: [Uint8Array, Array]
   * }
   * ```
   *
   * Intermediate and leaf node form:
   * ```
   * [Uint8Array, Array]
   * ```
   *
   * The `Uint8Array` in both forms is the 'map' used to identify the presence of an element in this node.
   *
   * The second element in the tuple in both forms, `Array`, is an elements array a mix of either buckets or links:
   *
   * * A bucket is an array of two elements, the first being a `key` of type `Uint8Array` and the second a `value`
   *   or whatever type has been provided in `set()` operations for this `IAMap`.
   * * A link is an object of the type that the backing store provides upon `save()` operations and can be identified
   *   with `isLink()` calls.
   *
   * Buckets and links are differentiated by their "kind": a bucket is an array while a link is a "link" kind as dictated
   * by the backing store. We use `Array.isArray()` and `store.isLink()` to perform this differentiation.
   *
   * @returns {SerializedNode|SerializedRoot} An object representing the internal state of this local `IAMap` node, including its links to child nodes
   * if any.
   */
  toSerializable () {
    const map = this.map
    const data = this.data.map((/** @type {Element} */ e) => {
      return e.toSerializable()
    })
    /**
     * @ignore
     * @type {SerializedNode}
     */
    const hamt = [map, data]
    if (this.depth !== 0) {
      return hamt
    }
    /**
     * @ignore
     * @type {SerializedElement}
     */
    return {
      hashAlg: this.config.hashAlg,
      bucketSize: this.config.bucketSize,
      hamt
    }
  }

  /**
   * Calculate the number of entries locally stored by this node. Performs a scan of local buckets and adds up
   * their size.
   *
   * @returns {number} A number representing the number of local entries.
   */
  directEntryCount () {
    return this.data.reduce((/** @type {number} */ p, /** @type {Element} */ c) => {
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
    return this.data.reduce((/** @type {number} */ p, /** @type {Element} */ c) => {
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
    const size = await this.size()
    const entryArity = this.directEntryCount()
    const nodeArity = this.directNodeCount()
    const arity = entryArity + nodeArity
    let sizePredicate = 2 // 2 == 'more than one'
    if (nodeArity === 0) {
      sizePredicate = Math.min(2, entryArity) // 0, 1 or 2=='more than one'
    }

    const inv1 = size - entryArity >= 2 * (arity - entryArity)
    const inv2 = arity === 0 ? sizePredicate === 0 : true
    const inv3 = (arity === 1 && entryArity === 1) ? sizePredicate === 1 : true
    const inv4 = arity >= 2 ? sizePredicate === 2 : true
    const inv5 = nodeArity >= 0 && entryArity >= 0 && ((entryArity + nodeArity) === arity)

    return inv1 && inv2 && inv3 && inv4 && inv5
  }

  /**
   * A convenience shortcut to {@link iamap.fromSerializable} that uses this IAMap node instance's backing `store` and
   * configuration `options`. Intended to be used to instantiate child IAMap nodes from a root IAMap node.
   *
   * @param {any} id An optional ID for the instantiated IAMap node. See {@link iamap.fromSerializable}.
   * @param {any} serializable The serializable form of an IAMap node to be instantiated.
   * @param {number} [depth=0] The depth of the IAMap node. See {@link iamap.fromSerializable}.
  */
  fromChildSerializable (id, serializable, depth) {
    return fromSerializable(this.store, id, serializable, this.config, depth)
  }
}

/**
 * store a new node and assign it an ID
 * @ignore
 * @template T
 * @param {Store<T>} store
 * @param {IAMap<T>} newNode
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function save (store, newNode, options) {
  const id = await store.save(newNode.toSerializable(), options)
  newNode.id = id
  return newNode
}

/**
 * // utility function to avoid duplication since it's used across get(), set() and delete()
 * { bucket: { found: true, elementAt, element, bucketIndex, bucketEntry } }
 * { bucket: { found: false, elementAt, element } }
 * { link: { elementAt, element } }
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} bitpos
 * @param {Uint8Array} key
 * @returns {FoundElement}
 */
function findElement (node, bitpos, key) {
  const elementAt = index(node.map, bitpos)
  const element = node.data[elementAt]
  assert(!!element)
  if (element.bucket) { // data element
    for (let bucketIndex = 0; bucketIndex < element.bucket.length; bucketIndex++) {
      const bucketEntry = element.bucket[bucketIndex]
      if (byteCompare(bucketEntry.key, key) === 0) {
        return { data: { found: true, elementAt, element, bucketIndex, bucketEntry } }
      }
    }
    return { data: { found: false, elementAt, element } }
  }
  assert(!!element.link)
  return { link: { elementAt, element } }
}

/**
 * new element for this node, i.e. first time this hash portion has been seen here
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} bitpos
 * @param {Uint8Array} key
 * @param {any} value
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function addNewElement (node, bitpos, key, value, options) {
  const insertAt = index(node.map, bitpos)
  const newData = node.data.slice()
  newData.splice(insertAt, 0, new Element([new KV(key, value)]))
  const newMap = setBit(node.map, bitpos, true)
  return create(node.store, node.config, newMap, node.depth, newData, options)
}

/**
 * update an existing bucket with a new k/v pair
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} elementAt
 * @param {number} bucketAt
 * @param {Uint8Array} key
 * @param {any} value
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function updateBucket (node, elementAt, bucketAt, key, value, options) {
  const oldElement = node.data[elementAt]
  /* c8 ignore next 3 */
  if (!oldElement.bucket) {
    throw new Error('Unexpected error')
  }
  const newElement = new Element(oldElement.bucket.slice())
  const newKv = new KV(key, value)
  /* c8 ignore next 3 */
  if (!newElement.bucket) {
    throw new Error('Unexpected error')
  }
  if (bucketAt === -1) {
    newElement.bucket.push(newKv)
    // in-bucket sort is required to maintain a canonical state
    newElement.bucket.sort((/** @type {KV} */ a, /** @type {KV} */ b) => byteCompare(a.key, b.key))
  } else {
    newElement.bucket[bucketAt] = newKv
  }
  const newData = node.data.slice()
  newData[elementAt] = newElement
  return create(node.store, node.config, node.map, node.depth, newData, options)
}

/**
 * overflow of a bucket means it has to be replaced with a child node, tricky surgery
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} elementAt
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function replaceBucketWithNode (node, elementAt, options) {
  let newNode = new IAMap(node.store, node.config, undefined, node.depth + 1)
  const element = node.data[elementAt]
  assert(!!element)
  /* c8 ignore next 3 */
  if (!element.bucket) {
    throw new Error('Unexpected error')
  }
  for (const c of element.bucket) {
    newNode = await newNode.set(c.key, c.value)
  }
  newNode = await save(node.store, newNode, options)
  const newData = node.data.slice()
  newData[elementAt] = new Element(undefined, newNode.id)
  return create(node.store, node.config, node.map, node.depth, newData, options)
}

/**
 * similar to addNewElement() but for new child nodes
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} elementAt
 * @param {IAMap<T>} newChild
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function updateNode (node, elementAt, newChild, options) {
  assert(!!newChild.id)
  const newElement = new Element(undefined, newChild.id)
  const newData = node.data.slice()
  newData[elementAt] = newElement
  return create(node.store, node.config, node.map, node.depth, newData, options)
}

// take a node, extract all of its local entries and put them into a new node with a single
// bucket; used for collapsing a node and sending it upward
/**
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {Uint8Array} hash
 * @param {number} elementAt
 * @param {number} bucketIndex
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
function collapseIntoSingleBucket (node, hash, elementAt, bucketIndex, options) {
  // pretend it's depth=0 (it may end up being) and only 1 bucket
  const newMap = setBit(new Uint8Array(node.map.length), mask(hash, 0, node.config.bitWidth), true)
  /**
   * @ignore
   * @type {KV[]}
   */
  const newBucket = node.data.reduce((/** @type {KV[]} */ p, /** @type {Element} */ c, /** @type {number} */ i) => {
    if (i === elementAt) {
      /* c8 ignore next 3 */
      if (!c.bucket) {
        throw new Error('Unexpected error')
      }
      if (c.bucket.length === 1) { // only element in bucket, skip it
        return p
      } else {
        // there's more in this bucket, make a temporary one, remove it and concat it
        const tmpBucket = c.bucket.slice()
        tmpBucket.splice(bucketIndex, 1)
        return p.concat(tmpBucket)
      }
    } else {
      /* c8 ignore next 3 */
      if (!c.bucket) {
        throw new Error('Unexpected error')
      }
      return p.concat(c.bucket)
    }
  }, /** @type {KV[]} */ [])
  newBucket.sort((a, b) => byteCompare(a.key, b.key))
  const newElement = new Element(newBucket)
  return create(node.store, node.config, newMap, 0, [newElement], options)
}

// simple delete from an existing bucket in this node
/**
 * @ignore
 * @param {ReadonlyElement} data
 * @param {number} elementAt
 * @param {boolean} lastInBucket
 * @param {number} bucketIndex
 * @returns {Element[]}
 */
function removeFromBucket (data, elementAt, lastInBucket, bucketIndex) {
  const newData = data.slice()
  if (!lastInBucket) {
    // bucket will not be empty, remove only the element from it
    const oldElement = data[elementAt]
    /* c8 ignore next 3 */
    if (!oldElement.bucket) {
      throw new Error('Unexpected error')
    }
    const newElement = new Element(oldElement.bucket.slice())
    /* c8 ignore next 3 */
    if (!newElement.bucket) {
      throw new Error('Unexpected error')
    }
    newElement.bucket.splice(bucketIndex, 1)
    newData.splice(elementAt, 1, newElement) // replace old bucket
  } else {
    // empty bucket, just remove it
    newData.splice(elementAt, 1)
  }
  return newData
}

/**
 * a node has bubbled up from a recursive delete() and we need to extract its
 * contents and insert it into ours
 * @ignore
 * @template T
 * @param {IAMap<T>} node
 * @param {number} bitpos
 * @param {IAMap<T>} newNode
 * @param {AbortOptions} [options] - options for operations with the underlying store
 * @returns {Promise<IAMap<T>>}
 */
async function collapseNodeInline (node, bitpos, newNode, options) {
  // assume the newNode has a single bucket and it's sorted and ready to replace the place
  // it had in node's element array
  assert(newNode.data.length === 1)
  /* c8 ignore next 3 */
  if (!newNode.data[0].bucket) {
    throw new Error('Unexpected error')
  }
  const newBucket = newNode.data[0].bucket.slice()
  const newElement = new Element(newBucket)
  const elementIndex = index(node.map, bitpos)
  const newData = node.data.slice()
  newData[elementIndex] = newElement

  return create(node.store, node.config, node.map, node.depth, newData, options)
}

/**
 * @ignore
 * @param {Options} [options]
 * @returns {Config}
 */
function buildConfig (options) {
  /**
   * @ignore
   * @type {Config}
   */
  const config = {}

  if (!options) {
    throw new TypeError('Invalid `options` object')
  }

  if (!Number.isInteger(options.hashAlg)) {
    throw new TypeError('Invalid `hashAlg` option')
  }
  if (!hasherRegistry[options.hashAlg]) {
    throw new TypeError(`Unknown hashAlg: '${options.hashAlg}'`)
  }
  config.hashAlg = options.hashAlg

  if (options.bitWidth !== undefined) {
    if (Number.isInteger(options.bitWidth)) {
      if (options.bitWidth < 3 || options.bitWidth > 16) {
        throw new TypeError('Invalid `bitWidth` option, must be between 3 and 16')
      }
      config.bitWidth = options.bitWidth
    } else {
      throw new TypeError('Invalid `bitWidth` option')
    }
  } else {
    config.bitWidth = defaultBitWidth
  }

  if (options.bucketSize !== undefined) {
    if (Number.isInteger(options.bucketSize)) {
      if (options.bucketSize < 2) {
        throw new TypeError('Invalid `bucketSize` option')
      }
      config.bucketSize = options.bucketSize
    } else {
      throw new TypeError('Invalid `bucketSize` option')
    }
  } else {
    config.bucketSize = defaultBucketSize
  }

  return config
}

/**
 * Determine if a serializable object is an IAMap root type, can be used to assert whether a data block is
 * an IAMap before trying to instantiate it.
 *
 * @name iamap.isRootSerializable
 * @function
 * @param {any} serializable An object that may be a serialisable form of an IAMap root node
 * @returns {boolean} An indication that the serialisable form is or is not an IAMap root node
 */
function isRootSerializable (serializable) {
  return typeof serializable === 'object' &&
    Number.isInteger(serializable.hashAlg) &&
    Number.isInteger(serializable.bucketSize) &&
    Array.isArray(serializable.hamt) &&
    isSerializable(serializable.hamt)
}

/**
 * Determine if a serializable object is an IAMap node type, can be used to assert whether a data block is
 * an IAMap node before trying to instantiate it.
 * This should pass for both root nodes as well as child nodes
 *
 * @name iamap.isSerializable
 * @function
 * @param {any} serializable An object that may be a serialisable form of an IAMap node
 * @returns {boolean} An indication that the serialisable form is or is not an IAMap node
 */
function isSerializable (serializable) {
  if (Array.isArray(serializable)) {
    return serializable.length === 2 && serializable[0] instanceof Uint8Array && Array.isArray(serializable[1])
  }
  return isRootSerializable(serializable)
}

/**
 * Instantiate an IAMap from a valid serialisable form of an IAMap node. The serializable should be the same as
 * produced by {@link IAMap#toSerializable}.
 * Serialised forms of root nodes must satisfy both {@link iamap.isRootSerializable} and {@link iamap.isSerializable}. For
 * root nodes, the `options` parameter will be ignored and the `depth` parameter must be the default value of `0`.
 * Serialised forms of non-root nodes must satisfy {@link iamap.isSerializable} and have a valid `options` parameter and
 * a non-`0` `depth` parameter.
 *
 * @name iamap.fromSerializable
 * @function
 * @template T
 * @param {Store<T>} store A backing store for this Map. See {@link iamap.create}.
 * @param {any} id An optional ID for the instantiated IAMap node. Unlike {@link iamap.create},
 * `fromSerializable()` does not `save()` a newly created IAMap node so an ID is not generated for it. If one is
 * required for downstream purposes it should be provided, if the value is `null` or `undefined`, `node.id` will
 * be `null` but will remain writable.
 * @param {any} serializable The serializable form of an IAMap node to be instantiated
 * @param {Options} [options=null] An options object for IAMap child node instantiation. Will be ignored for root
 * node instantiation (where `depth` = `0`) See {@link iamap.create}.
 * @param {number} [depth=0] The depth of the IAMap node. Where `0` is the root node and any `>0` number is a child
 * node.
 * @returns {IAMap<T>}
 */
function fromSerializable (store, id, serializable, options, depth = 0) {
  /**
   * @ignore
   * @type {SerializedNode}
   */
  let hamt
  if (depth === 0) { // even if options were supplied, ignore them and use what's in the serializable
    if (!isRootSerializable(serializable)) {
      throw new Error('Loaded object does not appear to be an IAMap root (depth==0)')
    }
    // don't use passed-in options
    options = serializableToOptions(serializable)
    hamt = serializable.hamt
  } else {
    if (!isSerializable(serializable)) {
      throw new Error('Loaded object does not appear to be an IAMap node (depth>0)')
    }
    hamt = serializable
  }
  const data = hamt[1].map(Element.fromSerializable.bind(null, store.isLink))
  const node = new IAMap(store, options, hamt[0], depth, data)
  if (id != null) {
    node.id = id
  }
  return node
}

/**
 * @ignore
 * @param {any} serializable
 * @returns {Config}
 */
function serializableToOptions (serializable) {
  return {
    hashAlg: serializable.hashAlg,
    bitWidth: Math.log2(serializable.hamt[0].length * 8), // inverse of (2**bitWidth) / 8
    bucketSize: serializable.bucketSize
  }
}

/**
 * @template T
 * @param {IAMap<T> | any} node
 * @returns {boolean}
 */
IAMap.isIAMap = function isIAMap (node) {
  return node instanceof IAMap
}

/**
 * internal utility to fetch a map instance's hash function
 *
 * @ignore
 * @template T
 * @param {IAMap<T>} map
 * @returns {Hasher}
 */
function hasher (map) {
  return hasherRegistry[map.config.hashAlg].hasher
}

/**
 * @ignore
 * @param {Uint8Array} b1
 * @param {Uint8Array} b2
 * @returns {number}
 */
function byteCompare (b1, b2) {
  let x = b1.length
  let y = b2.length

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (b1[i] !== b2[i]) {
      x = b1[i]
      y = b2[i]
      break
    }
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

module.exports.create = create
module.exports.load = load
module.exports.registerHasher = registerHasher
module.exports.fromSerializable = fromSerializable
module.exports.isSerializable = isSerializable
module.exports.isRootSerializable = isRootSerializable
module.exports.IAMap = IAMap

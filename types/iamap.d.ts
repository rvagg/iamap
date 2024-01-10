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
 */
export function create<T>(store: import("./interface").Store<T>, options: Options, map?: Uint8Array | undefined, depth?: number | undefined, data?: Element[] | undefined): Promise<IAMap<T>>;
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
 */
export function load<T>(store: import("./interface").Store<T>, id: any, depth?: number | undefined, options?: import("./interface").Options | undefined): Promise<IAMap<T>>;
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
export function registerHasher(hashAlg: number, hashBytes: number, hasher: Hasher): void;
/**
 * Determine if a serializable object is an IAMap root type, can be used to assert whether a data block is
 * an IAMap before trying to instantiate it.
 *
 * @name iamap.isRootSerializable
 * @function
 * @param {any} serializable An object that may be a serialisable form of an IAMap root node
 * @returns {boolean} An indication that the serialisable form is or is not an IAMap root node
 */
export function isRootSerializable(serializable: any): boolean;
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
export function isSerializable(serializable: any): boolean;
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
export function fromSerializable<T>(store: import("./interface").Store<T>, id: any, serializable: any, options?: import("./interface").Options | undefined, depth?: number | undefined): IAMap<T>;
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
export class IAMap<T> {
    /**
     * @ignore
     * @param {Store<T>} store
     * @param {Options} [options]
     * @param {Uint8Array} [map]
     * @param {number} [depth]
     * @param {Element[]} [data]
     */
    constructor(store: Store<T>, options?: import("./interface").Options | undefined, map?: Uint8Array | undefined, depth?: number | undefined, data?: Element[] | undefined);
    store: import("./interface").Store<T>;
    /**
     * @ignore
     * @type {any|null}
     */
    id: any | null;
    config: import("./interface").Config;
    map: Uint8Array;
    depth: number;
    /**
     * @ignore
     * @type {ReadonlyElement}
     */
    data: ReadonlyElement;
    /**
     * Asynchronously create a new `IAMap` instance identical to this one but with `key` set to `value`.
     *
     * @param {(string|Uint8Array)} key - A key for the `value` being set whereby that same `value` may
     * be retrieved with a `get()` operation with the same `key`. The type of the `key` object should either be a
     * `Uint8Array` or be convertable to a `Uint8Array` via `TextEncoder.
     * @param {any} value - Any value that can be stored in the backing store. A value could be a serialisable object
     * or an address or content address or other kind of link to the actual value.
     * @param {Uint8Array} [_cachedHash] - for internal use
     * @returns {Promise<IAMap<T>>} A `Promise` containing a new `IAMap` that contains the new key/value pair.
     * @async
     */
    set(key: (string | Uint8Array), value: any, _cachedHash?: Uint8Array | undefined): Promise<IAMap<T>>;
    /**
     * Asynchronously find and return a value for the given `key` if it exists within this `IAMap`.
     *
     * @param {string|Uint8Array} key - A key for the value being sought. See {@link IAMap#set} for
     * details about acceptable `key` types.
     * @param {Uint8Array} [_cachedHash] - for internal use
     * @returns {Promise<any>} A `Promise` that resolves to the value being sought if that value exists within this `IAMap`. If the
     * key is not found in this `IAMap`, the `Promise` will resolve to `undefined`.
     * @async
     */
    get(key: string | Uint8Array, _cachedHash?: Uint8Array | undefined): Promise<any>;
    /**
     * Asynchronously find and return a boolean indicating whether the given `key` exists within this `IAMap`
     *
     * @param {string|Uint8Array} key - A key to check for existence within this `IAMap`. See
     * {@link IAMap#set} for details about acceptable `key` types.
     * @returns {Promise<boolean>} A `Promise` that resolves to either `true` or `false` depending on whether the `key` exists
     * within this `IAMap`.
     * @async
     */
    has(key: string | Uint8Array): Promise<boolean>;
    /**
     * Asynchronously create a new `IAMap` instance identical to this one but with `key` and its associated
     * value removed. If the `key` does not exist within this `IAMap`, this instance of `IAMap` is returned.
     *
     * @param {string|Uint8Array} key - A key to remove. See {@link IAMap#set} for details about
     * acceptable `key` types.
     * @param {Uint8Array} [_cachedHash] - for internal use
     * @returns {Promise<IAMap<T>>} A `Promise` that resolves to a new `IAMap` instance without the given `key` or the same `IAMap`
     * instance if `key` does not exist within it.
     * @async
     */
    delete(key: string | Uint8Array, _cachedHash?: Uint8Array | undefined): Promise<IAMap<T>>;
    /**
     * Asynchronously count the number of key/value pairs contained within this `IAMap`, including its children.
     *
     * @returns {Promise<number>} A `Promise` with a `number` indicating the number of key/value pairs within this `IAMap` instance.
     * @async
     */
    size(): Promise<number>;
    /**
     * Asynchronously emit all keys that exist within this `IAMap`, including its children. This will cause a full
     * traversal of all nodes.
     *
     * @returns {AsyncGenerator<Uint8Array>} An async iterator that yields keys. All keys will be in `Uint8Array` format regardless of which
     * format they were inserted via `set()`.
     * @async
     */
    keys(): AsyncGenerator<Uint8Array>;
    /**
     * Asynchronously emit all values that exist within this `IAMap`, including its children. This will cause a full
     * traversal of all nodes.
     *
     * @returns {AsyncGenerator<any>} An async iterator that yields values.
     * @async
     */
    values(): AsyncGenerator<any>;
    /**
     * Asynchronously emit all { key, value } pairs that exist within this `IAMap`, including its children. This will
     * cause a full traversal of all nodes.
     *
     * @returns {AsyncGenerator<{ key: Uint8Array, value: any}>} An async iterator that yields objects with the properties `key` and `value`.
     * @async
     */
    entries(): AsyncGenerator<{
        key: Uint8Array;
        value: any;
    }>;
    /**
     * Asynchronously emit the IDs of this `IAMap` and all of its children.
     *
     * @returns {AsyncGenerator<any>} An async iterator that yields the ID of this `IAMap` and all of its children. The type of ID is
     * determined by the backing store which is responsible for generating IDs upon `save()` operations.
     */
    ids(): AsyncGenerator<any>;
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
    toSerializable(): import("./interface").SerializedNode | SerializedRoot;
    /**
     * Calculate the number of entries locally stored by this node. Performs a scan of local buckets and adds up
     * their size.
     *
     * @returns {number} A number representing the number of local entries.
     */
    directEntryCount(): number;
    /**
     * Calculate the number of child nodes linked by this node. Performs a scan of the local entries and tallies up the
     * ones containing links to child nodes.
     *
     * @returns {number} A number representing the number of direct child nodes
     */
    directNodeCount(): number;
    /**
     * Asynchronously perform a check on this node and its children that it is in canonical format for the current data.
     * As this uses `size()` to calculate the total number of entries in this node and its children, it performs a full
     * scan of nodes and therefore incurs a load and deserialisation cost for each child node.
     * A `false` result from this method suggests a flaw in the implemetation.
     *
     * @async
     * @returns {Promise<boolean>} A Promise with a boolean value indicating whether this IAMap is correctly formatted.
     */
    isInvariant(): Promise<boolean>;
    /**
     * A convenience shortcut to {@link iamap.fromSerializable} that uses this IAMap node instance's backing `store` and
     * configuration `options`. Intended to be used to instantiate child IAMap nodes from a root IAMap node.
     *
     * @param {any} id An optional ID for the instantiated IAMap node. See {@link iamap.fromSerializable}.
     * @param {any} serializable The serializable form of an IAMap node to be instantiated.
     * @param {number} [depth=0] The depth of the IAMap node. See {@link iamap.fromSerializable}.
    */
    fromChildSerializable(id: any, serializable: any, depth?: number | undefined): IAMap<T>;
}
export namespace IAMap {
    /**
     * @template T
     * @param {IAMap<T> | any} node
     * @returns {boolean}
     */
    function isIAMap<T_1>(node: any): boolean;
}
/**
 * <T>
 */
export type Store<T> = import('./interface').Store<T>;
export type Config = import('./interface').Config;
export type Options = import('./interface').Options;
export type SerializedKV = import('./interface').SerializedKV;
export type SerializedElement = import('./interface').SerializedElement;
export type SerializedNode = import('./interface').SerializedNode;
export type SerializedRoot = import('./interface').SerializedRoot;
export type Hasher = (inp: Uint8Array) => (Uint8Array | Promise<Uint8Array>);
export type Registry = {
    hasher: Hasher;
    hashBytes: number;
}[];
export type IsLink = (link: any) => boolean;
export type ReadonlyElement = readonly Element[];
export type FoundElement = {
    data?: {
        found: boolean;
        elementAt: number;
        element: Element;
        bucketIndex?: number;
        bucketEntry?: KV;
    };
    link?: {
        elementAt: number;
        element: Element;
    };
};
declare class Element {
    /**
     * @ignore
     * @param {KV[]} [bucket]
     * @param {any} [link]
     */
    constructor(bucket?: KV[] | undefined, link?: any);
    bucket: KV[] | null;
    link: any;
    /**
     * @ignore
     * @returns {SerializedElement}
     */
    toSerializable(): SerializedElement;
}
declare namespace Element {
    /**
     * @ignore
     * @param {IsLink} isLink
     * @param {any} obj
     * @returns {Element}
     */
    function fromSerializable(isLink: IsLink, obj: any): Element;
}
/**
 * internal utility to fetch a map instance's hash function
 *
 * @ignore
 * @template T
 * @param {IAMap<T>} map
 * @returns {Hasher}
 */
declare function hasher<T>(map: IAMap<T>): Hasher;
/**
 * @ignore
 */
declare class KV {
    /**
     * @ignore
     * @param {Uint8Array} key
     * @param {any} value
     */
    constructor(key: Uint8Array, value: any);
    key: Uint8Array;
    value: any;
    /**
     * @ignore
     * @returns {SerializedKV}
     */
    toSerializable(): import("./interface").SerializedKV;
}
declare namespace KV {
    /**
     * @ignore
     * @param {SerializedKV} obj
     * @returns {KV}
     */
    function fromSerializable(obj: import("./interface").SerializedKV): KV;
}
export {};
//# sourceMappingURL=iamap.d.ts.map
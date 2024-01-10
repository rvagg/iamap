// Copyright Rod Vagg; Licensed under the Apache License, Version 2.0, see README.md for more information

// @ts-ignore
import murmurhash3 from 'murmurhash3js-revisited'
import { assert } from 'chai'

/**
 * @typedef {import('./interface').TestStore} TestStore
 */

/**
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
export function murmurHasher (key) {
  assert(key instanceof Uint8Array)
  const b = new Uint8Array(4)
  const view = new DataView(b.buffer)
  view.setUint32(0, murmurhash3.x86.hash32(key), true)
  return b
}

// probably best not to use this for real applications, unless your keys have the qualities of hashes
/**
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
export function identityHasher (key) {
  assert(key instanceof Uint8Array)
  return key
}

/**
 * @param {any} obj
 * @returns {number}
 */
function hash (obj) {
  return murmurhash3.x86.hash32(new TextEncoder().encode(JSON.stringify(obj)))
}

// simple util to generate stable content IDs for objects, this is not necessarily how
// you'd use IAMap, ideally your backing store would generate IDs for you, such as a
// CID for IPLD.

/**
 * @returns {TestStore}
 */
export function memoryStore () {
  return {
    map: new Map(),
    saves: 0,
    loads: 0,
    async save (obj) {
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

/**
 * @param {any} obj
 * @returns {Uint8Array}
 */
function toBytes (obj) {
  if (obj instanceof Uint8Array && obj.constructor.name === 'Uint8Array') {
    return obj
  }
  if (obj instanceof ArrayBuffer) {
    return new Uint8Array(obj)
  }
  if (ArrayBuffer.isView(obj)) {
    return new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength)
  }
  /* c8 ignore next */
  throw new Error('Unknown type, must be binary type')
}

/**
 * @param {Uint8Array} d
 * @returns {string}
 */
export function toHex (d) {
  if (typeof d === 'string') {
    return d
  }
  // @ts-ignore
  return Array.prototype.reduce.call(toBytes(d), (p, c) => `${p}${c.toString(16).padStart(2, '0')}`, '')
}

/**
 * @param {string|Uint8Array} hex
 * @returns {Uint8Array}
 */
export function fromHex (hex) {
  if (hex instanceof Uint8Array) {
    return hex
  }
  if (!hex.length) {
    return new Uint8Array(0)
  }
  return new Uint8Array(hex.split('')
    // @ts-ignore
    .map((c, i, d) => i % 2 === 0 ? `0x${c}${d[i + 1]}` : '')
    .filter(Boolean)
    // @ts-ignore
    .map((e) => parseInt(e, 16)))
}

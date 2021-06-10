// store using a link type `T`
export interface Store<T> {
  save(node: any): T,
  load(id: T): any,
  isLink(link: T): boolean,
  isEqual(link1: T, link2: T): boolean,
}

export interface Options {
  bitWidth?: number,
  bucketSize?: number,
  hashAlg: number
}

export interface Config {
  bitWidth: number,
  bucketSize: number,
  hashAlg: number
}

export type SerializedKV = [Uint8Array, any]

export type SerializedElement = SerializedKV | any /* link */

export interface SerializedNode {
  map: Uint8Array,
  data: SerializedElement[]
}

export interface SerializedRoot extends SerializedNode {
  hashAlg: number,
  bucketSize: number,
}
// store using a link type `T`
export interface Store<T> {
  save(node: any, options?: AbortOptions): Promise<T>,
  load(id: T, options?: AbortOptions): Promise<any>,
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

export interface AbortOptions {
  signal?: AbortSignal
}

export type SerializedKV = [Uint8Array, any]

export type SerializedElement = SerializedKV | any /* link */

type NodeMap = Uint8Array
type NodeData = SerializedElement[]

export type SerializedNode = [NodeMap, NodeData]

export interface SerializedRoot {
  hashAlg: number,
  bucketSize: number,
  hamt: SerializedNode
}

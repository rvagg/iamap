export interface StoreOperationOptions {
    signal?: AbortSignal;
}
export interface Store<T> {
    save(node: any, options?: StoreOperationOptions): Promise<T>;
    load(id: T, options?: StoreOperationOptions): Promise<any>;
    isLink(link: T): boolean;
    isEqual(link1: T, link2: T): boolean;
}
export interface Options {
    bitWidth?: number;
    bucketSize?: number;
    hashAlg: number;
}
export interface Config {
    bitWidth: number;
    bucketSize: number;
    hashAlg: number;
}
export type SerializedKV = [Uint8Array, any];
export type SerializedElement = SerializedKV | any;
type NodeMap = Uint8Array;
type NodeData = SerializedElement[];
export type SerializedNode = [NodeMap, NodeData];
export interface SerializedRoot {
    hashAlg: number;
    bucketSize: number;
    hamt: SerializedNode;
}
export {};
//# sourceMappingURL=interface.d.ts.map
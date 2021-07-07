export interface Store<T> {
    save(node: any): T;
    load(id: T): any;
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
export declare type SerializedKV = [Uint8Array, any];
export declare type SerializedElement = SerializedKV | any;
declare type NodeMap = Uint8Array;
declare type NodeData = SerializedElement[];
export declare type SerializedNode = [NodeMap, NodeData];
export interface SerializedRoot {
    hashAlg: number;
    bucketSize: number;
    hamt: SerializedNode;
}
export {};
//# sourceMappingURL=interface.d.ts.map
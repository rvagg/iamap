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
export interface SerializedNode {
    map: Uint8Array;
    data: SerializedElement[];
}
export interface SerializedRoot extends SerializedNode {
    hashAlg: number;
    bucketSize: number;
}
//# sourceMappingURL=interface.d.ts.map
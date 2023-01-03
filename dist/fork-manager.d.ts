/// <reference types="node" />
export declare type Runnable = () => Promise<any> | any;
export declare class ForkManager {
    private static readonly runnables;
    static register(name: string, runnable: Runnable): void;
    static fork(forkPath: string, env: any): import("child_process").ChildProcess;
    static start(): boolean;
}

/// <reference types="node" />
/// <reference types="node" />
import type { ChildProcess } from 'child_process';
export declare type MessengerFunction<R = any, T = any> = (payload: T, unsubscriber?: () => void) => Promise<R> | R;
export declare type MessengerListenerFunction<T = any> = (payload: T, unsubscriber?: () => void) => Promise<void> | void;
export declare class Messenger {
    private onMessageHandler;
    private readonly pendingMessages;
    private readonly handlers;
    private readonly listeners;
    private channel;
    constructor(channel?: NodeJS.Process | ChildProcess);
    connect(channel: NodeJS.Process | ChildProcess): void;
    disconnect(): void;
    invoke<R = any, T = any>(event: string, payload?: T): Promise<R>;
    handle(event: string, fn: MessengerFunction): void;
    listen(event: string, fn: MessengerListenerFunction): void;
}

/// <reference types="node" />
/// <reference types="node" />
import type { ChildProcess } from 'node:child_process';
export declare type MessengerHandlerFunction<R = any, T = any> = (payload: T, unsubscriber?: () => void) => Promise<R> | R;
export declare type MessengerListenerFunction<T = any> = (payload: T, unsubscriber?: () => void) => Promise<void> | void;
export declare class Messenger {
    private readonly who;
    private onMessageHandler;
    private onExitHandler;
    private readonly pendingMessages;
    private readonly handlers;
    private readonly listeners;
    private readonly exitListeners;
    private channel;
    constructor(channel?: NodeJS.Process | ChildProcess, who?: string);
    private sendStatus;
    protected connect(channel: NodeJS.Process | ChildProcess): void;
    protected disconnect(): void;
    invoke<R = any, T = any>(event: string, payload?: T): Promise<R>;
    onExit(fn: MessengerListenerFunction): () => boolean;
    handle(event: string, fn: MessengerHandlerFunction): () => boolean;
    listen(event: string, fn: MessengerListenerFunction): () => boolean;
}

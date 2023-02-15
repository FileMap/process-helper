import uuid from 'uuid-random';

import type { ChildProcess } from 'node:child_process';

export type MessengerHandlerFunction<R = any, T = any> = (payload: T, unsubscriber?: ()=> void)=> Promise<R> | R;

export type MessengerListenerFunction<T = any> = (payload: T, unsubscriber?: ()=> void)=> Promise<void> | void;

class Deferred<R = any> {
    private promise: Promise<R>;

    public reject!: (reason?: Error | any)=> void;

    public resolve!: (value: R)=> void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }

    public wait() {
        return this.promise;
    }
}

export class Messenger {
    private onMessageHandler: undefined | ((...args: any[])=> void);

    private onExitHandler: undefined | ((...args: any[])=> void);

    // maps requestId, resolve function
    private readonly pendingMessages: Map<string, Deferred> = new Map();

    // handlers are responsible for sending the response on requests
    // maps event name, callback function
    private readonly handlers: Map<string, MessengerHandlerFunction> = new Map();

    // listeners are side effects of requests, they do not return responses
    // maps event name, callback function set
    private readonly listeners: Map<string, Set<MessengerListenerFunction>> = new Map();

    private readonly exitListeners = new Set<MessengerListenerFunction>();

    private channel: NodeJS.Process | ChildProcess | undefined;

    constructor(channel?: NodeJS.Process | ChildProcess, private readonly who = 'unknown') {
        if (channel) {
            this.connect(channel);
        }
    }

    private sendStatus(status: 'connected' | 'disconnected') {
        if (!this.channel) return;
        if (!this.channel.send) return;
        const requestId = uuid();
        this.channel.send({ id: requestId, event: 'StatusChange', payload: { who: this.who, status } }, (err) => {
            if (err) console.error('[ProcessHelper::Messenger]', 'Error while sending status change:', err);
        });
    }

    protected connect(channel: NodeJS.Process | ChildProcess) {
        this.channel = channel;

        this.onMessageHandler = async (message: { event: string, id: string, payload: any, err?: any }) => {
            if (this.pendingMessages.has(message.id)) {
                // we've received a response to our previously sent request

                const fn = this.pendingMessages.get(message.id)!;
                this.pendingMessages.delete(message.id);

                if (message.err) {
                    if (message.err instanceof Error) {
                        fn.reject(message.err);
                    } else {
                        fn.reject(new Error(message.err));
                    }
                } else {
                    fn.resolve(message.payload);
                }

                return;
            }

            // new request arrived
            const handleFn = this.handlers.get(message.event);
            if (handleFn) {
                // we've a handler for this request, so we'll invoke it and send the response back

                try {
                    const payload = await handleFn(message.payload);

                    this.channel!.send!({ id: message.id, event: message.event, payload }, (err) => {
                        if (err) console.error('[ProcessHelper::Messenger]', 'Error while returning response:', err);
                    });
                } catch (e) {
                    this.channel!.send!({ id: message.id, event: message.event, err: (e as any)?.message || e }, (err) => {
                        if (err) console.error('[ProcessHelper::Messenger]', 'Error while returning error:', err);
                    });
                }
            }

            const fns = this.listeners.get(message.event);
            if (fns) {
                await Promise.all(
                    Array.from(fns.values())
                        .map(async (s) => {
                            try {
                                await s(message.payload, () => this.listeners.get(message.event)!.delete(s));
                            } catch (err) {
                                console.error('[ProcessHelper::Messenger]', 'Error on listener:', err);
                            }
                        }),
                );
            }
        };

        this.onExitHandler = async (payload: any) => {
            await Promise.all(
                Array.from(this.exitListeners.values())
                    .map(async (s) => {
                        try {
                            await s(payload, () => this.exitListeners.delete(s));
                        } catch (err) {
                            console.error('[ProcessHelper::Messenger]', 'Error on listener:', err);
                        }
                    }),
            );
        };

        this.channel.on('message', this.onMessageHandler);
        this.channel.on('exit', this.onExitHandler);

        this.sendStatus('connected');
    }

    protected disconnect() {
        this.channel!.off('message', this.onMessageHandler!);
        this.channel!.off('exit', this.onExitHandler!);

        this.sendStatus('disconnected');

        this.pendingMessages.forEach(p => p.reject(new Error('Process was disconnected')));
        this.pendingMessages.clear();

        this.onMessageHandler = undefined;
        this.channel = undefined;
    }

    public async invoke<R = any, T = any>(event: string, payload?: T) {
        return new Promise<R>((resolve, reject) => {
            const requestId = uuid();

            const deferred = new Deferred<R>();
            this.pendingMessages.set(requestId, deferred);

            this.channel!.send!({ id: requestId, event, payload }, (err) => {
                if (err) {
                    this.pendingMessages.delete(requestId);

                    reject(err);
                } else {
                    deferred.wait().then(resolve).catch(reject);
                }
            });
        });
    }

    public onExit(fn: MessengerListenerFunction) {
        this.exitListeners.add(fn);

        return () => this.exitListeners.delete(fn);
    }

    public handle(event: string, fn: MessengerHandlerFunction) {
        if (this.handlers.has(event)) {
            throw new Error('cannot register more than one invoke handler');
        }

        this.handlers.set(event, fn);

        return () => this.handlers.delete(event);
    }

    public listen(event: string, fn: MessengerListenerFunction) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)!.add(fn);

        return () => this.listeners.get(event)!.delete(fn);
    }
}

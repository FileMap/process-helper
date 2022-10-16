import uuid from 'uuid-random';

import type { ChildProcess } from 'child_process';

export type MessengerFunction<R = any, T = any> = (payload: T, unsubscriber?: ()=> void)=> Promise<R> | R;

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

    // maps requestId, resolve function
    private readonly pendingMessages: Map<string, Deferred> = new Map();

    // handlers are responsible for sending the response on requests
    // maps event name, callback function
    private readonly handlers: Map<string, MessengerFunction> = new Map();

    // listeners are side effects of requests, they do not return responses
    // maps event name, callback function set
    private readonly listeners: Map<string, Set<MessengerFunction>> = new Map();

    private channel: NodeJS.Process | ChildProcess | undefined;

    constructor(channel?: NodeJS.Process | ChildProcess) {
        if (channel) {
            this.connect(channel);
        }
    }

    public connect(channel: NodeJS.Process | ChildProcess) {
        this.channel = channel;

        this.onMessageHandler = async (message: { event: string, id: string, payload: any, err?: string }) => {
            if (this.pendingMessages.has(message.id)) { // we've received a response to our previously sent request
                const fn = this.pendingMessages.get(message.id)!;
                this.pendingMessages.delete(message.id);

                if (message.err) {
                    fn.reject(message.err);
                } else {
                    fn.resolve(message.payload);
                }
            } else { // new request arrived
                const handleFn = this.handlers.get(message.event);
                if (handleFn) { // return the response
                    try {
                        const payload = await handleFn(message.payload);

                        this.channel!.send!({ id: message.id, event: message.event, payload }, (err) => {
                            if (err) console.error('Error while sending message', err);
                        });
                    } catch (err) {
                        console.error('Error in handler:', err);

                        this.channel!.send!({ id: message.id, event: message.event, err: (err as any)?.message || err }, (err2) => {
                            if (err2) console.error('Error while sending message', err2);
                        });
                    }
                }

                const fns = this.listeners.get(message.event);
                if (fns) {
                    await Promise.all(Array.from(fns.values())
                        .map(async (s) => {
                            try {
                                await s(message.payload, () => this.listeners.get(message.event)!.delete(s));
                            } catch (err) {
                                console.error('Error on subscriber:', err);
                            }
                        }));
                }
            }
        };

        this.channel.on('message', this.onMessageHandler);
    }

    public disconnect() {
        this.channel!.off('message', this.onMessageHandler!);
        this.pendingMessages.forEach(p => p.reject(new Error('Process was disconnected')));

        this.pendingMessages.clear();
        this.handlers.clear();
        this.listeners.clear();

        this.onMessageHandler = undefined;
        this.channel = undefined;
    }

    public async invoke<R = any, T = any>(event: string, payload?: T) {
        try {
            const requestId = uuid();

            const deferred = new Deferred<R>();
            this.pendingMessages.set(requestId, deferred);

            this.channel!.send!({ id: requestId, event, payload }, (err) => {
                if (err) console.error('Error while sending message', err);
            });

            return await deferred.wait();
        } catch (err) {
            console.error('Error in messenger.send', err);
            throw err;
        }
    }

    public handle(event: string, fn: MessengerFunction) {
        if (this.handlers.has(event)) {
            throw new Error('cannot register more than one invoke handler');
        }

        this.handlers.set(event, fn);
    }

    public listen(event: string, fn: MessengerListenerFunction) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)!.add(fn);
    }
}

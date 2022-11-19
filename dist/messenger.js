"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messenger = void 0;
const uuid_random_1 = __importDefault(require("uuid-random"));
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
    wait() {
        return this.promise;
    }
}
class Messenger {
    constructor(channel) {
        this.pendingMessages = new Map();
        this.handlers = new Map();
        this.listeners = new Map();
        if (channel) {
            this.connect(channel);
        }
    }
    connect(channel) {
        this.channel = channel;
        this.onMessageHandler = async (message) => {
            if (this.pendingMessages.has(message.id)) {
                const fn = this.pendingMessages.get(message.id);
                this.pendingMessages.delete(message.id);
                if (message.err) {
                    if (message.err instanceof Error) {
                        fn.reject(message.err);
                    }
                    else {
                        fn.reject(new Error(message.err));
                    }
                }
                else {
                    fn.resolve(message.payload);
                }
            }
            else {
                const handleFn = this.handlers.get(message.event);
                if (handleFn) {
                    try {
                        const payload = await handleFn(message.payload);
                        this.channel.send({ id: message.id, event: message.event, payload }, (err) => {
                            if (err)
                                console.error('[ProcessHelper::Messenger]', 'Error while returning response:', err);
                        });
                    }
                    catch (e) {
                        this.channel.send({ id: message.id, event: message.event, err: e?.message || e }, (err) => {
                            if (err)
                                console.error('[ProcessHelper::Messenger]', 'Error while returning error:', err);
                        });
                    }
                }
                const fns = this.listeners.get(message.event);
                if (fns) {
                    await Promise.all(Array.from(fns.values())
                        .map(async (s) => {
                        try {
                            await s(message.payload, () => this.listeners.get(message.event).delete(s));
                        }
                        catch (err) {
                            console.error('[ProcessHelper::Messenger]', 'Error on listener:', err);
                        }
                    }));
                }
            }
        };
        this.channel.on('message', this.onMessageHandler);
    }
    disconnect() {
        this.channel.off('message', this.onMessageHandler);
        this.pendingMessages.forEach(p => p.reject(new Error('Process was disconnected')));
        this.pendingMessages.clear();
        this.onMessageHandler = undefined;
        this.channel = undefined;
    }
    async invoke(event, payload) {
        return new Promise((resolve, reject) => {
            const requestId = (0, uuid_random_1.default)();
            const deferred = new Deferred();
            this.pendingMessages.set(requestId, deferred);
            this.channel.send({ id: requestId, event, payload }, (err) => {
                if (err) {
                    this.pendingMessages.delete(requestId);
                    reject(err);
                }
                else {
                    deferred.wait().then(resolve).catch(reject);
                }
            });
        });
    }
    handle(event, fn) {
        if (this.handlers.has(event)) {
            throw new Error('cannot register more than one invoke handler');
        }
        this.handlers.set(event, fn);
    }
    listen(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(fn);
    }
}
exports.Messenger = Messenger;

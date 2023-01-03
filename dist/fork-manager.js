"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkManager = void 0;
const node_child_process_1 = require("node:child_process");
function fetchProcessRequest() {
    for (const arg of process.argv) {
        if (arg.startsWith('--ph-fork=')) {
            return arg.slice('--ph-fork='.length);
        }
    }
    return null;
}
class ForkManager {
    static register(name, runnable) {
        ForkManager.runnables.set(name, runnable);
    }
    static fork(forkPath, env) {
        if (this.runnables.has(forkPath)) {
            const newArgs = process.argv.slice();
            newArgs.splice(1, 0, `--ph-fork=${forkPath}`);
            return (0, node_child_process_1.spawn)(process.execPath, newArgs, {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...env },
            });
        }
        return (0, node_child_process_1.fork)(forkPath, {
            detached: false,
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            env: { ...process.env, ...env },
        });
    }
    static start() {
        const request = fetchProcessRequest();
        if (request) {
            const runnable = ForkManager.runnables.get(request);
            if (runnable) {
                setImmediate(async () => {
                    try {
                        await runnable();
                    }
                    catch (e) {
                        console.error(e);
                        process.exit(1);
                    }
                });
            }
            return false;
        }
        return true;
    }
}
exports.ForkManager = ForkManager;
ForkManager.runnables = new Map();

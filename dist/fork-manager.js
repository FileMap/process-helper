"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkManager = void 0;
const index_js_1 = __importDefault(require("electron/index.js"));
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
    static fork(forkPath, cwd, env) {
        if (this.runnables.has(forkPath)) {
            const newArgs = process.argv.slice();
            newArgs.shift();
            newArgs.splice(1, 0, `--ph-fork=${forkPath}`);
            newArgs.splice(1, 0, '--disable_gpu');
            return (0, node_child_process_1.spawn)(index_js_1.default, newArgs, {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...env },
                cwd,
            });
        }
        return (0, node_child_process_1.fork)(forkPath, {
            detached: false,
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            env: { ...process.env, ...env },
            cwd,
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

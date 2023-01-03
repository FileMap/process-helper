"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkManager = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
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
            const pathFile = node_path_1.default.join(cwd, 'node_modules/electron/path.txt');
            let executablePath = process.execPath;
            if (node_fs_1.default.existsSync(pathFile)) {
                const electronPath = node_fs_1.default.readFileSync(pathFile, 'utf-8');
                executablePath = node_path_1.default.join(cwd, 'node_modules/electron/dist', electronPath);
            }
            const newArgs = process.argv.slice();
            newArgs.shift();
            newArgs.splice(1, 0, `--ph-fork=${forkPath}`);
            newArgs.splice(1, 0, '--disable_gpu');
            return (0, node_child_process_1.spawn)(executablePath, newArgs, {
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

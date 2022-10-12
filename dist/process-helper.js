"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHelper = void 0;
const child_process_1 = require("child_process");
const tree_kill_1 = __importDefault(require("tree-kill"));
const messenger_1 = require("./messenger");
class ProcessHelper extends messenger_1.Messenger {
    constructor(forkPath) {
        super();
        this.forkPath = forkPath;
        ProcessHelper.instances.add(this);
    }
    static killAll() {
        ProcessHelper.instances.forEach(p => p.stop());
        ProcessHelper.instances.clear();
    }
    setEnv(env) {
        this.env = env;
    }
    isStarted() {
        return !!this.childProcess;
    }
    start(autoRestart = true) {
        if (!this.childProcess) {
            this.childProcess = (0, child_process_1.fork)(this.forkPath, {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...this.env },
            });
            if (!this.childProcess.pid) {
                this.childProcess = undefined;
                return;
            }
            if (autoRestart) {
                this.childProcess.on('exit', () => {
                    this.disconnect();
                    this.childProcess = undefined;
                    this.start();
                });
            }
            this.connect(this.childProcess);
        }
    }
    stop() {
        if (this.childProcess) {
            if (this.childProcess.pid) {
                this.disconnect();
                this.childProcess.removeAllListeners();
                (0, tree_kill_1.default)(this.childProcess.pid);
                this.childProcess = undefined;
            }
            else {
                console.warn('cannot kill child process because pid is undefined');
            }
        }
    }
    restart() {
        this.stop();
        this.start();
    }
}
exports.ProcessHelper = ProcessHelper;
ProcessHelper.instances = new Set();
process.on('beforeExit', () => {
    ProcessHelper.killAll();
});
process.on('exit', () => {
    ProcessHelper.killAll();
});
process.on('SIGHUP', () => {
    ProcessHelper.killAll();
});
process.on('SIGINT', () => {
    ProcessHelper.killAll();
});
process.on('SIGTERM', () => {
    ProcessHelper.killAll();
});

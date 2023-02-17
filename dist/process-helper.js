"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHelper = void 0;
const node_child_process_1 = require("node:child_process");
const messenger_1 = require("./messenger");
class ProcessHelper extends messenger_1.Messenger {
    constructor(forkPath) {
        super();
        this.forkPath = forkPath;
        this.errorHandler = (...args) => {
            console.error('child process error', ...args);
            this.autoRestartListener?.(...args);
        };
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
            this.childProcess = (0, node_child_process_1.fork)(this.forkPath, {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...this.env },
            });
            if (!this.childProcess.pid) {
                this.childProcess = undefined;
                return;
            }
            if (autoRestart) {
                this.autoRestartListener = () => {
                    this.disconnect();
                    this.childProcess = undefined;
                    this.autoRestartListener = undefined;
                    this.start();
                };
                this.childProcess.on('exit', this.autoRestartListener);
                this.childProcess.on('error', this.errorHandler);
            }
            this.connect(this.childProcess);
        }
    }
    stop() {
        console.log('stopping child process', !!this.childProcess, 'pid:', this.childProcess?.pid);
        if (this.childProcess) {
            if (this.childProcess.pid) {
                this.disconnect();
                this.childProcess.off('exit', this.autoRestartListener);
                this.childProcess.off('error', this.errorHandler);
                this.autoRestartListener = undefined;
                this.childProcess.kill('SIGTERM');
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
const killHandler = () => {
    ProcessHelper.killAll();
    process.exit(0);
};
process.on('SIGINT', killHandler);
process.on('SIGTERM', killHandler);
process.on('SIGQUIT', killHandler);

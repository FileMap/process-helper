"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHelper = void 0;
const fork_manager_1 = require("fork-manager");
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
            this.childProcess = fork_manager_1.ForkManager.fork(this.forkPath, this.env);
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
            }
            this.connect(this.childProcess);
        }
    }
    stop() {
        if (this.childProcess) {
            if (this.childProcess.pid) {
                this.disconnect();
                this.childProcess.off('exit', this.autoRestartListener);
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

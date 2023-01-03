import { ForkManager } from 'fork-manager';

import { Messenger } from './messenger';

import type { ChildProcess } from 'node:child_process';

export class ProcessHelper extends Messenger {
    private static instances = new Set<ProcessHelper>();

    public static killAll() {
        ProcessHelper.instances.forEach(p => p.stop());
        ProcessHelper.instances.clear();
    }

    private env: any;

    private childProcess: ChildProcess | undefined;

    private autoRestartListener: undefined | ((...args: any[])=> void);

    constructor(private readonly forkPath: string) {
        super();

        ProcessHelper.instances.add(this);
    }

    public setEnv(env: any) {
        this.env = env;
    }

    public isStarted() {
        return !!this.childProcess;
    }

    public start(autoRestart = true) {
        if (!this.childProcess) {
            this.childProcess = ForkManager.fork(this.forkPath, this.env);
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

    public stop() {
        if (this.childProcess) {
            if (this.childProcess.pid) {
                this.disconnect();

                this.childProcess.off('exit', this.autoRestartListener!);
                this.autoRestartListener = undefined;

                this.childProcess.kill('SIGTERM');
                this.childProcess = undefined;
            } else {
                console.warn('cannot kill child process because pid is undefined');
            }
        }
    }

    public restart() {
        this.stop();
        this.start();
    }
}

const killHandler = () => {
    ProcessHelper.killAll();
    process.exit(0);
};

process.on('SIGINT', killHandler);
process.on('SIGTERM', killHandler);
process.on('SIGQUIT', killHandler);

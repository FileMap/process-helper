import { fork } from 'child_process';

import { Messenger } from './messenger';

import type { ChildProcess } from 'child_process';

export class ProcessHelper extends Messenger {
    private static instances = new Set<ProcessHelper>();

    private env: any;

    private childProcess: ChildProcess | undefined;

    constructor(private readonly forkPath: string) {
        super();

        ProcessHelper.instances.add(this);
    }

    public static killAll() {
        ProcessHelper.instances.forEach(p => p.stop());
        ProcessHelper.instances.clear();
    }

    public setEnv(env: any) {
        this.env = env;
    }

    public isStarted() {
        return !!this.childProcess;
    }

    public start(autoRestart = true) {
        if (!this.childProcess) {
            this.childProcess = fork(
                this.forkPath,
                {
                    detached: false,
                    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                    env: { ...process.env, ...this.env },
                },
            );

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

    public stop() {
        if (this.childProcess) {
            if (this.childProcess.pid) {
                this.disconnect();

                // we need to remove all listener to make sure that
                // the process will not restart
                this.childProcess.removeAllListeners();

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

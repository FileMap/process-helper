import { fork, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type Runnable = ()=> Promise<any> | any;

function fetchProcessRequest() {
    for (const arg of process.argv) {
        if (arg.startsWith('--ph-fork=')) {
            return arg.slice('--ph-fork='.length);
        }
    }

    return null;
}

export class ForkManager {
    private static readonly runnables = new Map<string, Runnable>();

    public static register(name: string, runnable: Runnable) {
        ForkManager.runnables.set(name, runnable);
    }

    public static fork(forkPath: string, cwd: string, env: any) {
        if (this.runnables.has(forkPath)) {
            const pathFile = path.join(cwd, 'node_modules/electron/path.txt');

            let executablePath = process.execPath;
            if (fs.existsSync(pathFile)) {
                const electronPath = fs.readFileSync(pathFile, 'utf-8');
                executablePath = path.join(cwd, 'node_modules/electron/dist', electronPath);
            }

            const newArgs = process.argv.slice();
            newArgs.shift();
            newArgs.splice(1, 0, `--ph-fork=${forkPath}`);
            newArgs.splice(1, 0, '--disable_gpu');

            return spawn(
                executablePath,
                newArgs,
                {
                    detached: false,
                    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                    env: { ...process.env, ...env },
                    cwd,
                },
            );
        }

        return fork(
            forkPath,
            {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...env },
                cwd,
            },
        );
    }

    public static start() {
        const request = fetchProcessRequest();

        if (request) {
            const runnable = ForkManager.runnables.get(request);
            if (runnable) {
                setImmediate(async () => {
                    try {
                        await runnable();
                    } catch (e) {
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

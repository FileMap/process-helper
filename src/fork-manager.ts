import { fork, spawn } from 'node:child_process';

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

    public static fork(forkPath: string, env: any) {
        if (this.runnables.has(forkPath)) {
            return spawn(
                process.execPath,
                [`--ph-fork=${forkPath}`],
                {
                    detached: false,
                    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                    env: { ...process.env, ...env },
                },
            );
        }

        return fork(
            forkPath,
            {
                detached: false,
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: { ...process.env, ...env },
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

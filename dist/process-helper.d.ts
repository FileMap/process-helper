import { Messenger } from './messenger';
export declare class ProcessHelper extends Messenger {
    private readonly forkPath;
    private static instances;
    private env;
    private childProcess;
    constructor(forkPath: string);
    static killAll(): void;
    setEnv(env: any): void;
    start(autoRestart?: boolean): void;
    stop(): void;
    restart(): void;
}

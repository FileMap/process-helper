import { Messenger } from './messenger';
export declare class ProcessHelper extends Messenger {
    private readonly forkPath;
    private static instances;
    static killAll(): void;
    private env;
    private childProcess;
    private autoRestartListener;
    private errorHandler;
    constructor(forkPath: string);
    setEnv(env: any): void;
    isStarted(): boolean;
    start(autoRestart?: boolean): void;
    stop(): void;
    restart(): void;
}

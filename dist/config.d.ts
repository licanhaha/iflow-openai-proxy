/**
 * 配置管理模块
 * 支持环境变量和配置文件
 */
export interface ServerConfig {
    port: number;
    host: string;
    cors: boolean;
    corsOrigins: string[];
}
export interface IFlowConfig {
    baseUrl: string;
    port: number;
    timeout: number;
    autoStartProcess: boolean;
    debugLogging: boolean;
    authMethodId?: string;
    apiKey?: string;
    modelName?: string;
}
export interface ModelMapping {
    alias: string;
    actualModel: string;
    name?: string;
    description?: string;
    maxTokens?: number;
}
export interface AppConfig {
    server: ServerConfig;
    iflow: IFlowConfig;
    models: {
        default: string;
        mappings: ModelMapping[];
    };
    performance: {
        maxConnections: number;
        requestTimeout: number;
        streamBufferMs: number;
    };
}
declare const defaultConfig: AppConfig;
export declare function loadConfig(configPath?: string): AppConfig;
export declare function resolveModel(modelAlias: string, config: AppConfig): string;
export declare function getModelConfig(modelAlias: string, config: AppConfig): ModelMapping | undefined;
export { defaultConfig };
//# sourceMappingURL=config.d.ts.map
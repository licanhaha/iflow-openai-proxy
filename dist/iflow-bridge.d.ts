/**
 * iFlow CLI 桥接模块
 * 使用 @iflow-ai/iflow-cli-sdk 实现与 iFlow CLI 的通信
 */
import { IFlowClient } from '@iflow-ai/iflow-cli-sdk';
import type { ChatCompletionRequest, ChatCompletionChunk } from './openai-types';
export type StreamCallback = (chunk: ChatCompletionChunk) => void;
export type CompleteCallback = (fullText: string) => void;
interface ConnectionPoolOptions {
    maxConnections: number;
    timeout: number;
    authMethodId?: string;
    apiKey?: string;
    modelName?: string;
}
interface ActiveConnection {
    client: IFlowClient;
    inUse: boolean;
    lastUsed: number;
    id: string;
    currentModel?: string;
}
/**
 * iFlow 连接池管理器
 * 实现连接复用，提升性能
 */
export declare class IFlowConnectionPool {
    private connections;
    private options;
    private baseUrl;
    private cleanupInterval;
    constructor(baseUrl: string, options: ConnectionPoolOptions);
    acquire(): Promise<ActiveConnection>;
    release(conn: ActiveConnection): void;
    private createConnection;
    private cleanupIdleConnections;
    closeAll(): Promise<void>;
}
/**
 * iFlow 桥接器
 * 将 OpenAI API 请求转换为 iFlow CLI 调用
 */
export declare class IFlowBridge {
    private pool;
    private debug;
    private cachedModels;
    constructor(baseUrl: string, options: {
        maxConnections: number;
        timeout: number;
        debug: boolean;
        authMethodId?: string;
        apiKey?: string;
        modelName?: string;
    });
    /**
     * 获取可用模型列表
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * 执行聊天完成请求
     */
    chatCompletion(request: ChatCompletionRequest, onStream?: StreamCallback): Promise<{
        text: string;
        finishReason: string;
    }>;
    /**
     * 构建提示词
     */
    private buildPrompt;
    /**
     * 映射结束原因
     */
    private mapFinishReason;
    /**
     * 关闭桥接器
     */
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=iflow-bridge.d.ts.map
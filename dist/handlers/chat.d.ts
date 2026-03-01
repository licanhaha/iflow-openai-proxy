/**
 * Chat Completions 处理器
 * 实现 OpenAI Chat Completions API 端点
 */
import type { Response } from 'express';
import type { ChatCompletionRequest } from '../openai-types';
import { IFlowBridge } from '../iflow-bridge';
import type { AppConfig } from '../config';
export declare class ChatHandler {
    private bridge;
    private config;
    constructor(bridge: IFlowBridge, config: AppConfig);
    /**
     * 处理 Chat Completions 请求
     */
    handleChatCompletion(req: {
        body: ChatCompletionRequest;
    }, res: Response): Promise<void>;
    /**
     * 验证请求
     */
    private validateRequest;
    /**
     * 处理非流式请求
     */
    private handleNonStreamingRequest;
    /**
     * 处理流式请求
     */
    private handleStreamingRequest;
    /**
     * 发送 SSE 消息
     */
    private sendSSE;
    /**
     * 错误处理
     */
    private handleError;
    /**
     * 估算 token 数量（简单估算）
     */
    private estimateTokens;
}
//# sourceMappingURL=chat.d.ts.map
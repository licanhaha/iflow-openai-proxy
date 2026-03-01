"use strict";
/**
 * Chat Completions 处理器
 * 实现 OpenAI Chat Completions API 端点
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHandler = void 0;
const openai_types_1 = require("../openai-types");
const config_1 = require("../config");
const uuid_1 = require("uuid");
class ChatHandler {
    bridge;
    config;
    constructor(bridge, config) {
        this.bridge = bridge;
        this.config = config;
    }
    /**
     * 处理 Chat Completions 请求
     */
    async handleChatCompletion(req, res) {
        try {
            const request = req.body;
            // 验证请求
            this.validateRequest(request);
            // 解析模型
            const actualModel = (0, config_1.resolveModel)(request.model, this.config);
            // 是否流式响应
            const stream = request.stream ?? false;
            if (stream) {
                await this.handleStreamingRequest(request, actualModel, res);
            }
            else {
                await this.handleNonStreamingRequest(request, actualModel, res);
            }
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    /**
     * 验证请求
     */
    validateRequest(request) {
        if (!request.model) {
            throw new openai_types_1.OpenAIError('Missing required field: model', 'invalid_request_error', 400);
        }
        if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
            throw new openai_types_1.OpenAIError('Missing required field: messages', 'invalid_request_error', 400);
        }
        for (const msg of request.messages) {
            if (!msg.role) {
                throw new openai_types_1.OpenAIError('Missing role in message', 'invalid_request_error', 400);
            }
            if (!msg.content && !msg.tool_calls && !msg.function_call) {
                throw new openai_types_1.OpenAIError('Message must have content, tool_calls, or function_call', 'invalid_request_error', 400);
            }
        }
    }
    /**
     * 处理非流式请求
     */
    async handleNonStreamingRequest(request, model, res) {
        try {
            const { text, finishReason } = await this.bridge.chatCompletion(request);
            const response = {
                id: `chatcmpl-${(0, uuid_1.v4)()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: text,
                        },
                        finish_reason: finishReason,
                    }],
                usage: {
                    prompt_tokens: this.estimateTokens(request.messages),
                    completion_tokens: this.estimateTokens([{ role: 'assistant', content: text }]),
                    total_tokens: this.estimateTokens(request.messages) + this.estimateTokens([{ role: 'assistant', content: text }]),
                },
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    /**
     * 处理流式请求
     */
    async handleStreamingRequest(request, model, res) {
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        // 发送初始角色块
        const responseId = `chatcmpl-${(0, uuid_1.v4)()}`;
        const initialChunk = {
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                    index: 0,
                    delta: { role: 'assistant' },
                    finish_reason: null,
                }],
        };
        this.sendSSE(res, initialChunk);
        try {
            await this.bridge.chatCompletion(request, (chunk) => {
                this.sendSSE(res, chunk);
            });
            // 发送 [DONE] 标记
            res.write('data: [DONE]\n\n');
            res.end();
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    /**
     * 发送 SSE 消息
     */
    sendSSE(res, data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    /**
     * 错误处理
     */
    handleError(error, res) {
        if (error instanceof openai_types_1.OpenAIError) {
            res.status(error.statusCode).json(error.toResponse());
        }
        else if (error instanceof Error) {
            const openaiError = new openai_types_1.OpenAIError(error.message, 'internal_error', 500);
            res.status(500).json(openaiError.toResponse());
        }
        else {
            const err = error;
            res.status(500).json({
                error: {
                    message: err?.message || 'Unknown error',
                    type: 'internal_error',
                },
            });
        }
    }
    /**
     * 估算 token 数量（简单估算）
     */
    estimateTokens(messages) {
        let totalChars = 0;
        for (const msg of messages) {
            const content = typeof msg.content === 'string'
                ? msg.content
                : msg.content.map((c) => c.text || '').join('');
            totalChars += content.length;
            totalChars += msg.role.length;
        }
        // 粗略估算：4个字符约等于1个token
        return Math.ceil(totalChars / 4);
    }
}
exports.ChatHandler = ChatHandler;
//# sourceMappingURL=chat.js.map
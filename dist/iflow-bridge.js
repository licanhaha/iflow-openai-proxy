"use strict";
/**
 * iFlow CLI 桥接模块
 * 使用 @iflow-ai/iflow-cli-sdk 实现与 iFlow CLI 的通信
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFlowBridge = exports.IFlowConnectionPool = void 0;
const iflow_cli_sdk_1 = require("@iflow-ai/iflow-cli-sdk");
const uuid_1 = require("uuid");
/**
 * iFlow 连接池管理器
 * 实现连接复用，提升性能
 */
class IFlowConnectionPool {
    connections = [];
    options;
    baseUrl;
    cleanupInterval;
    constructor(baseUrl, options) {
        this.baseUrl = baseUrl;
        this.options = options;
        // 定期清理空闲连接
        this.cleanupInterval = setInterval(() => this.cleanupIdleConnections(), 30000);
    }
    // 获取可用连接
    async acquire() {
        // 查找空闲连接
        const idle = this.connections.find(c => !c.inUse);
        if (idle) {
            idle.inUse = true;
            idle.lastUsed = Date.now();
            return idle;
        }
        // 创建新连接
        if (this.connections.length < this.options.maxConnections) {
            const conn = await this.createConnection();
            this.connections.push(conn);
            return conn;
        }
        // 等待可用连接
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection pool timeout'));
            }, this.options.timeout);
            const check = () => {
                const idle = this.connections.find(c => !c.inUse);
                if (idle) {
                    clearTimeout(timeout);
                    idle.inUse = true;
                    idle.lastUsed = Date.now();
                    resolve(idle);
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    // 释放连接
    release(conn) {
        conn.inUse = false;
        conn.lastUsed = Date.now();
    }
    // 创建新连接
    async createConnection() {
        const options = {
            url: this.baseUrl,
            timeout: this.options.timeout,
            autoStartProcess: true,
        };
        // 配置认证信息
        if (this.options.authMethodId || this.options.apiKey) {
            options.authMethodId = this.options.authMethodId;
            options.authMethodInfo = {
                apiKey: this.options.apiKey,
                modelName: this.options.modelName,
            };
        }
        const client = new iflow_cli_sdk_1.IFlowClient(options);
        await client.connect();
        return {
            client,
            inUse: true,
            lastUsed: Date.now(),
            id: (0, uuid_1.v4)(),
            currentModel: undefined,
        };
    }
    // 清理空闲连接
    cleanupIdleConnections() {
        const now = Date.now();
        const maxIdleTime = 60000; // 60秒空闲后关闭
        this.connections = this.connections.filter(conn => {
            if (!conn.inUse && now - conn.lastUsed > maxIdleTime) {
                conn.client.disconnect().catch(() => { });
                return false;
            }
            return true;
        });
    }
    // 关闭所有连接
    async closeAll() {
        clearInterval(this.cleanupInterval);
        await Promise.all(this.connections.map(conn => conn.client.disconnect().catch(() => { })));
        this.connections = [];
    }
}
exports.IFlowConnectionPool = IFlowConnectionPool;
/**
 * iFlow 桥接器
 * 将 OpenAI API 请求转换为 iFlow CLI 调用
 */
class IFlowBridge {
    pool;
    debug;
    cachedModels = [];
    constructor(baseUrl, options) {
        this.pool = new IFlowConnectionPool(baseUrl, {
            maxConnections: options.maxConnections,
            timeout: options.timeout,
            authMethodId: options.authMethodId,
            apiKey: options.apiKey,
            modelName: options.modelName,
        });
        this.debug = options.debug;
    }
    /**
     * 获取可用模型列表
     */
    async getAvailableModels() {
        if (this.cachedModels.length > 0) {
            return this.cachedModels;
        }
        const conn = await this.pool.acquire();
        try {
            const models = await conn.client.config.get('models');
            if (Array.isArray(models)) {
                // 提取模型ID
                this.cachedModels = models.map(m => typeof m === 'string' ? m : m.id);
            }
            else {
                this.cachedModels = [];
            }
            return this.cachedModels;
        }
        finally {
            this.pool.release(conn);
        }
    }
    /**
     * 执行聊天完成请求
     */
    async chatCompletion(request, onStream) {
        const conn = await this.pool.acquire();
        try {
            // 设置模型（如果请求中的模型与当前模型不同）
            const requestedModel = request.model;
            if (requestedModel && conn.currentModel !== requestedModel) {
                if (this.debug) {
                    console.log(`[iFlow] Setting model to: ${requestedModel}`);
                }
                await conn.client.config.set('model', requestedModel);
                conn.currentModel = requestedModel;
            }
            // 构建提示词
            const prompt = this.buildPrompt(request.messages);
            if (this.debug) {
                console.log('[iFlow] Sending prompt:', prompt.substring(0, 200) + '...');
            }
            // 发送消息
            await conn.client.sendMessage(prompt);
            let fullText = '';
            let finishReason = 'stop';
            const responseId = `chatcmpl-${(0, uuid_1.v4)()}`;
            const created = Math.floor(Date.now() / 1000);
            // 接收响应
            for await (const message of conn.client.receiveMessages()) {
                if (message.type === iflow_cli_sdk_1.MessageType.ASSISTANT) {
                    const assistantMsg = message;
                    const text = assistantMsg.chunk?.text || '';
                    if (text) {
                        fullText += text;
                        // 流式回调
                        if (onStream) {
                            const chunk = {
                                id: responseId,
                                object: 'chat.completion.chunk',
                                created,
                                model: request.model,
                                choices: [{
                                        index: 0,
                                        delta: { content: text },
                                        finish_reason: null,
                                    }],
                            };
                            onStream(chunk);
                        }
                    }
                }
                else if (message.type === iflow_cli_sdk_1.MessageType.TASK_FINISH) {
                    const finishMsg = message;
                    finishReason = this.mapFinishReason(finishMsg.stopReason || 'end_turn');
                    break;
                }
            }
            // 发送结束标记
            if (onStream) {
                const finalChunk = {
                    id: responseId,
                    object: 'chat.completion.chunk',
                    created,
                    model: request.model,
                    choices: [{
                            index: 0,
                            delta: {},
                            finish_reason: finishReason,
                        }],
                };
                onStream(finalChunk);
            }
            return { text: fullText, finishReason };
        }
        finally {
            this.pool.release(conn);
        }
    }
    /**
     * 构建提示词
     */
    buildPrompt(messages) {
        const parts = [];
        for (const msg of messages) {
            const content = typeof msg.content === 'string'
                ? msg.content
                : msg.content.map(c => c.text || '').join('\n');
            switch (msg.role) {
                case 'system':
                    parts.push(`[System]\n${content}`);
                    break;
                case 'user':
                    parts.push(`[User]\n${content}`);
                    break;
                case 'assistant':
                    parts.push(`[Assistant]\n${content}`);
                    break;
                default:
                    parts.push(content);
            }
        }
        return parts.join('\n\n');
    }
    /**
     * 映射结束原因
     */
    mapFinishReason(reason) {
        switch (reason) {
            case 'end_turn':
                return 'stop';
            case 'max_tokens':
                return 'length';
            default:
                return 'stop';
        }
    }
    /**
     * 关闭桥接器
     */
    async close() {
        await this.pool.closeAll();
    }
}
exports.IFlowBridge = IFlowBridge;
//# sourceMappingURL=iflow-bridge.js.map
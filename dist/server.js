"use strict";
/**
 * HTTP 服务器
 * 实现 OpenAI 兼容 API 服务器
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const chat_1 = require("./handlers/chat");
const models_1 = require("./handlers/models");
const iflow_bridge_1 = require("./iflow-bridge");
const config_1 = require("./config");
const openai_types_1 = require("./openai-types");
class Server {
    app;
    config;
    bridge;
    chatHandler;
    modelsHandler;
    server;
    constructor(config) {
        this.config = config || (0, config_1.loadConfig)();
        this.app = (0, express_1.default)();
        this.bridge = new iflow_bridge_1.IFlowBridge(this.config.iflow.baseUrl, {
            maxConnections: this.config.performance.maxConnections,
            timeout: this.config.iflow.timeout,
            debug: this.config.iflow.debugLogging,
            authMethodId: this.config.iflow.authMethodId,
            apiKey: this.config.iflow.apiKey,
            modelName: this.config.iflow.modelName,
        });
        this.chatHandler = new chat_1.ChatHandler(this.bridge, this.config);
        this.modelsHandler = new models_1.ModelsHandler(this.config, this.bridge);
        this.setupMiddleware();
        this.setupRoutes();
    }
    /**
     * 配置中间件
     */
    setupMiddleware() {
        // CORS
        if (this.config.server.cors) {
            this.app.use((0, cors_1.default)({
                origin: this.config.server.corsOrigins,
                credentials: true,
            }));
        }
        // JSON 解析
        this.app.use(express_1.default.json({ limit: '10mb' }));
        // 请求日志
        if (this.config.iflow.debugLogging) {
            this.app.use((req, _res, next) => {
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
                next();
            });
        }
        // 请求超时
        this.app.use((req, res, next) => {
            res.setTimeout(this.config.performance.requestTimeout, () => {
                res.status(408).json({
                    error: {
                        message: 'Request timeout',
                        type: 'timeout_error',
                    },
                });
            });
            next();
        });
    }
    /**
     * 配置路由
     */
    setupRoutes() {
        // 健康检查
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        // API 版本信息
        this.app.get('/v1', (_req, res) => {
            res.json({
                object: 'api_info',
                version: '1.0.0',
                description: 'OpenAI-compatible API powered by iFlow CLI',
            });
        });
        // 模型列表
        this.app.get('/v1/models', async (req, res) => {
            await this.modelsHandler.handleListModels(req, res);
        });
        // 单个模型
        this.app.get('/v1/models/:model', async (req, res) => {
            await this.modelsHandler.handleGetModel(req, res);
        });
        // Chat Completions
        this.app.post('/v1/chat/completions', (req, res) => {
            this.chatHandler.handleChatCompletion(req, res);
        });
        // 404 处理
        this.app.use((_req, res) => {
            res.status(404).json({
                error: {
                    message: 'Not found',
                    type: 'invalid_request_error',
                    code: 'not_found',
                },
            });
        });
        // 错误处理
        this.app.use((err, _req, res, _next) => {
            if (err instanceof openai_types_1.OpenAIError) {
                res.status(err.statusCode).json(err.toResponse());
            }
            else {
                console.error('Unhandled error:', err);
                res.status(500).json({
                    error: {
                        message: err.message || 'Internal server error',
                        type: 'internal_error',
                    },
                });
            }
        });
    }
    /**
     * 启动服务器
     */
    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.config.server.port, this.config.server.host, () => {
                console.log(`🚀 iFlow OpenAI Proxy Server started`);
                console.log(`📡 Listening on http://${this.config.server.host}:${this.config.server.port}`);
                console.log(`🔗 API endpoint: http://localhost:${this.config.server.port}/v1`);
                console.log(`🤖 Default model: ${this.config.models.default}`);
                console.log(`📊 Max connections: ${this.config.performance.maxConnections}`);
                resolve();
            });
        });
    }
    /**
     * 停止服务器
     */
    async stop() {
        if (this.server) {
            await this.bridge.close();
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('Server stopped');
                    resolve();
                });
            });
        }
    }
    /**
     * 获取 Express 应用
     */
    getApp() {
        return this.app;
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map
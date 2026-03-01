/**
 * HTTP 服务器
 * 实现 OpenAI 兼容 API 服务器
 */
import express from 'express';
import { type AppConfig } from './config';
export declare class Server {
    private app;
    private config;
    private bridge;
    private chatHandler;
    private modelsHandler;
    private server?;
    constructor(config?: AppConfig);
    /**
     * 配置中间件
     */
    private setupMiddleware;
    /**
     * 配置路由
     */
    private setupRoutes;
    /**
     * 启动服务器
     */
    start(): Promise<void>;
    /**
     * 停止服务器
     */
    stop(): Promise<void>;
    /**
     * 获取 Express 应用
     */
    getApp(): express.Application;
}
//# sourceMappingURL=server.d.ts.map
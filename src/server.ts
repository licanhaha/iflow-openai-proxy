/**
 * HTTP 服务器
 * 实现 OpenAI 兼容 API 服务器
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { ChatHandler } from './handlers/chat';
import { ModelsHandler } from './handlers/models';
import { IFlowBridge } from './iflow-bridge';
import { loadConfig, type AppConfig } from './config';
import { OpenAIError } from './openai-types';

export class Server {
  private app: express.Application;
  private config: AppConfig;
  private bridge: IFlowBridge;
  private chatHandler: ChatHandler;
  private modelsHandler: ModelsHandler;
  private server?: ReturnType<typeof express.application.listen>;

  constructor(config?: AppConfig) {
    this.config = config || loadConfig();
    this.app = express();
    this.bridge = new IFlowBridge(
      this.config.iflow.baseUrl,
      {
        maxConnections: this.config.performance.maxConnections,
        timeout: this.config.iflow.timeout,
        debug: this.config.iflow.debugLogging,
        authMethodId: this.config.iflow.authMethodId,
        apiKey: this.config.iflow.apiKey,
        modelName: this.config.iflow.modelName,
      }
    );
    this.chatHandler = new ChatHandler(this.bridge, this.config);
    this.modelsHandler = new ModelsHandler(this.config, this.bridge);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 配置中间件
   */
  private setupMiddleware(): void {
    // CORS
    if (this.config.server.cors) {
      this.app.use(cors({
        origin: this.config.server.corsOrigins,
        credentials: true,
      }));
    }

    // JSON 解析
    this.app.use(express.json({ limit: '10mb' }));

    // 请求日志
    if (this.config.iflow.debugLogging) {
      this.app.use((req: Request, _res: Response, next: NextFunction) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
      });
    }

    // 请求超时
    this.app.use((req: Request, res: Response, next: NextFunction) => {
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
  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API 版本信息
    this.app.get('/v1', (_req: Request, res: Response) => {
      res.json({
        object: 'api_info',
        version: '1.0.0',
        description: 'OpenAI-compatible API powered by iFlow CLI',
      });
    });

    // 模型列表
    this.app.get('/v1/models', async (req: Request, res: Response) => {
      await this.modelsHandler.handleListModels(req, res);
    });

    // 单个模型
    this.app.get('/v1/models/:model', async (req: Request, res: Response) => {
      await this.modelsHandler.handleGetModel(req as unknown as { params: { model: string } }, res);
    });

    // Chat Completions
    this.app.post('/v1/chat/completions', (req: Request, res: Response) => {
      this.chatHandler.handleChatCompletion(req, res);
    });

    // 404 处理
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: {
          message: 'Not found',
          type: 'invalid_request_error',
          code: 'not_found',
        },
      });
    });

    // 错误处理
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof OpenAIError) {
        res.status(err.statusCode).json(err.toResponse());
      } else {
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
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(
        this.config.server.port,
        this.config.server.host,
        () => {
          console.log(`🚀 iFlow OpenAI Proxy Server started`);
          console.log(`📡 Listening on http://${this.config.server.host}:${this.config.server.port}`);
          console.log(`🔗 API endpoint: http://localhost:${this.config.server.port}/v1`);
          console.log(`🤖 Default model: ${this.config.models.default}`);
          console.log(`📊 Max connections: ${this.config.performance.maxConnections}`);
          resolve();
        }
      );
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.server) {
      await this.bridge.close();
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('Server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * 获取 Express 应用
   */
  getApp(): express.Application {
    return this.app;
  }
}

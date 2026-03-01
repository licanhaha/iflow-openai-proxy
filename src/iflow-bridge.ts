/**
 * iFlow CLI 桥接模块
 * 使用 @iflow-ai/iflow-cli-sdk 实现与 iFlow CLI 的通信
 */

import {
  IFlowClient,
  MessageType,
  type IFlowOptions,
  type AssistantMessage,
  type TaskFinishMessage,
} from '@iflow-ai/iflow-cli-sdk';
import type { ChatMessage, ChatCompletionRequest, ChatCompletionChunk } from './openai-types';
import { v4 as uuidv4 } from 'uuid';

// 响应回调类型
export type StreamCallback = (chunk: ChatCompletionChunk) => void;
export type CompleteCallback = (fullText: string) => void;

// 连接池配置
interface ConnectionPoolOptions {
  maxConnections: number;
  timeout: number;
  authMethodId?: string;
  apiKey?: string;
  modelName?: string;
}

// 活跃连接
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
export class IFlowConnectionPool {
  private connections: ActiveConnection[] = [];
  private options: ConnectionPoolOptions;
  private baseUrl: string;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(baseUrl: string, options: ConnectionPoolOptions) {
    this.baseUrl = baseUrl;
    this.options = options;
    
    // 定期清理空闲连接
    this.cleanupInterval = setInterval(() => this.cleanupIdleConnections(), 30000);
  }

  // 获取可用连接
  async acquire(): Promise<ActiveConnection> {
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
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // 释放连接
  release(conn: ActiveConnection): void {
    conn.inUse = false;
    conn.lastUsed = Date.now();
  }

  // 创建新连接
  private async createConnection(): Promise<ActiveConnection> {
    const options: IFlowOptions = {
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

    const client = new IFlowClient(options);
    await client.connect();

    return {
      client,
      inUse: true,
      lastUsed: Date.now(),
      id: uuidv4(),
      currentModel: undefined,
    };
  }

  // 清理空闲连接
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const maxIdleTime = 60000; // 60秒空闲后关闭

    this.connections = this.connections.filter(conn => {
      if (!conn.inUse && now - conn.lastUsed > maxIdleTime) {
        conn.client.disconnect().catch(() => {});
        return false;
      }
      return true;
    });
  }

  // 关闭所有连接
  async closeAll(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    await Promise.all(
      this.connections.map(conn => conn.client.disconnect().catch(() => {}))
    );
    
    this.connections = [];
  }
}

/**
 * iFlow 桥接器
 * 将 OpenAI API 请求转换为 iFlow CLI 调用
 */
export class IFlowBridge {
  private pool: IFlowConnectionPool;
  private debug: boolean;
  private cachedModels: string[] = [];

  constructor(baseUrl: string, options: { 
    maxConnections: number; 
    timeout: number; 
    debug: boolean;
    authMethodId?: string;
    apiKey?: string;
    modelName?: string;
  }) {
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
  async getAvailableModels(): Promise<string[]> {
    if (this.cachedModels.length > 0) {
      return this.cachedModels;
    }

    const conn = await this.pool.acquire();
    try {
      const models = await conn.client.config.get('models') as Array<{ id: string; name?: string }> | undefined;
      if (Array.isArray(models)) {
        // 提取模型ID
        this.cachedModels = models.map(m => typeof m === 'string' ? m : m.id);
      } else {
        this.cachedModels = [];
      }
      return this.cachedModels;
    } finally {
      this.pool.release(conn);
    }
  }

  /**
   * 执行聊天完成请求
   */
  async chatCompletion(
    request: ChatCompletionRequest,
    onStream?: StreamCallback
  ): Promise<{ text: string; finishReason: string }> {
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
      const responseId = `chatcmpl-${uuidv4()}`;
      const created = Math.floor(Date.now() / 1000);

      // 接收响应
      for await (const message of conn.client.receiveMessages()) {
        if (message.type === MessageType.ASSISTANT) {
          const assistantMsg = message as AssistantMessage;
          const text = assistantMsg.chunk?.text || '';
          
          if (text) {
            fullText += text;

            // 流式回调
            if (onStream) {
              const chunk: ChatCompletionChunk = {
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
        } else if (message.type === MessageType.TASK_FINISH) {
          const finishMsg = message as TaskFinishMessage;
          finishReason = this.mapFinishReason(finishMsg.stopReason || 'end_turn');
          break;
        }
      }

      // 发送结束标记
      if (onStream) {
        const finalChunk: ChatCompletionChunk = {
          id: responseId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: finishReason as 'stop' | 'length',
          }],
        };
        onStream(finalChunk);
      }

      return { text: fullText, finishReason };
    } finally {
      this.pool.release(conn);
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(messages: ChatMessage[]): string {
    const parts: string[] = [];

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
  private mapFinishReason(reason: string): string {
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
  async close(): Promise<void> {
    await this.pool.closeAll();
  }
}
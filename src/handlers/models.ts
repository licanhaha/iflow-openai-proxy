/**
 * 模型列表处理器
 * 实现 OpenAI Models API 端点
 */

import type { Response } from 'express';
import type { ModelsResponse, ModelConfig } from '../openai-types';
import type { AppConfig } from '../config';
import { IFlowBridge } from '../iflow-bridge';

// iFlow 模型信息接口
interface IFlowModelInfo {
  id: string;
  name?: string;
  description?: string;
  capabilities?: {
    thinking?: boolean;
  };
}

export class ModelsHandler {
  private config: AppConfig;
  private bridge?: IFlowBridge;
  private cachedModels: ModelConfig[] | null = null;

  constructor(config: AppConfig, bridge?: IFlowBridge) {
    this.config = config;
    this.bridge = bridge;
  }

  /**
   * 设置桥接器
   */
  setBridge(bridge: IFlowBridge): void {
    this.bridge = bridge;
  }

  /**
   * 获取模型列表（从iFlow CLI动态获取）
   */
  private async getModels(): Promise<ModelConfig[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    // 尝试从iFlow CLI获取可用模型
    if (this.bridge) {
      try {
        const conn = await (this.bridge as any).pool.acquire();
        const models = await conn.client.config.get('models') as IFlowModelInfo[] | undefined;
        (this.bridge as any).pool.release(conn);

        if (Array.isArray(models) && models.length > 0) {
          this.cachedModels = models.map(model => ({
            id: model.id,
            name: model.name || model.id,
            description: model.description || model.name || model.id,
            maxTokens: undefined,
            supportsStreaming: true,
            supportsFunctionCalling: true,
            supportsVision: true,
          }));
          return this.cachedModels;
        }
      } catch (error) {
        console.warn('Failed to get models from iFlow CLI, using config models:', error);
      }
    }

    // 使用配置文件中的模型
    return this.config.models.mappings.map(mapping => ({
      id: mapping.alias,
      name: mapping.name || mapping.alias,
      description: mapping.description,
      maxTokens: mapping.maxTokens,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: true,
    }));
  }

  /**
   * 处理模型列表请求
   */
  async handleListModels(_req: unknown, res: Response): Promise<void> {
    try {
      const models = await this.getModels();
      const response: ModelsResponse = {
        object: 'list',
        data: models,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Failed to get models',
          type: 'internal_error',
        },
      });
    }
  }

  /**
   * 获取单个模型信息
   */
  async handleGetModel(req: { params: { model: string } }, res: Response): Promise<void> {
    const modelAlias = req.params.model;

    try {
      const models = await this.getModels();
      const model = models.find(m => m.id === modelAlias);

      if (!model) {
        res.status(404).json({
          error: {
            message: `Model '${modelAlias}' not found`,
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        });
        return;
      }

      res.json({
        object: 'model',
        ...model,
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Failed to get model',
          type: 'internal_error',
        },
      });
    }
  }

  /**
   * 清除模型缓存
   */
  clearCache(): void {
    this.cachedModels = null;
  }
}

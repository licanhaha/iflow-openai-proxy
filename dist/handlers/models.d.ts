/**
 * 模型列表处理器
 * 实现 OpenAI Models API 端点
 */
import type { Response } from 'express';
import type { AppConfig } from '../config';
import { IFlowBridge } from '../iflow-bridge';
export declare class ModelsHandler {
    private config;
    private bridge?;
    private cachedModels;
    constructor(config: AppConfig, bridge?: IFlowBridge);
    /**
     * 设置桥接器
     */
    setBridge(bridge: IFlowBridge): void;
    /**
     * 获取模型列表（从iFlow CLI动态获取）
     */
    private getModels;
    /**
     * 处理模型列表请求
     */
    handleListModels(_req: unknown, res: Response): Promise<void>;
    /**
     * 获取单个模型信息
     */
    handleGetModel(req: {
        params: {
            model: string;
        };
    }, res: Response): Promise<void>;
    /**
     * 清除模型缓存
     */
    clearCache(): void;
}
//# sourceMappingURL=models.d.ts.map
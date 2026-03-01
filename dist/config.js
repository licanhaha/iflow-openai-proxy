"use strict";
/**
 * 配置管理模块
 * 支持环境变量和配置文件
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.loadConfig = loadConfig;
exports.resolveModel = resolveModel;
exports.getModelConfig = getModelConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 默认配置
const defaultConfig = {
    server: {
        port: 3000,
        host: '0.0.0.0',
        cors: true,
        corsOrigins: ['*'],
    },
    iflow: {
        baseUrl: 'ws://localhost:8090/acp',
        port: 8090,
        timeout: 120000,
        autoStartProcess: true,
        debugLogging: false,
        authMethodId: undefined,
        apiKey: undefined,
        modelName: undefined,
    },
    models: {
        default: 'gpt-4',
        mappings: [
            { alias: 'gpt-4', actualModel: 'gpt-4', description: 'GPT-4', maxTokens: 8192 },
            { alias: 'gpt-4-turbo', actualModel: 'gpt-4-turbo', description: 'GPT-4 Turbo', maxTokens: 128000 },
            { alias: 'gpt-3.5-turbo', actualModel: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo', maxTokens: 4096 },
            { alias: 'claude-3-opus', actualModel: 'claude-3-opus', description: 'Claude 3 Opus', maxTokens: 200000 },
            { alias: 'claude-3-sonnet', actualModel: 'claude-3-sonnet', description: 'Claude 3 Sonnet', maxTokens: 200000 },
        ],
    },
    performance: {
        maxConnections: 100,
        requestTimeout: 300000,
        streamBufferMs: 50,
    },
};
exports.defaultConfig = defaultConfig;
// 从环境变量加载配置
function loadFromEnv() {
    const config = {};
    // 服务器配置
    if (process.env.IFLOW_PROXY_PORT) {
        config.server = {
            ...defaultConfig.server,
            port: parseInt(process.env.IFLOW_PROXY_PORT, 10),
        };
    }
    if (process.env.IFLOW_PROXY_HOST) {
        config.server = { ...config.server ?? defaultConfig.server, host: process.env.IFLOW_PROXY_HOST };
    }
    // iFlow配置
    if (process.env.IFLOW_BASE_URL) {
        config.iflow = { ...defaultConfig.iflow, baseUrl: process.env.IFLOW_BASE_URL };
    }
    if (process.env.IFLOW_PORT) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, port: parseInt(process.env.IFLOW_PORT, 10) };
    }
    if (process.env.IFLOW_TIMEOUT) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, timeout: parseInt(process.env.IFLOW_TIMEOUT, 10) };
    }
    if (process.env.IFLOW_DEBUG) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, debugLogging: process.env.IFLOW_DEBUG === 'true' };
    }
    // 认证配置
    if (process.env.IFLOW_AUTH_METHOD_ID) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, authMethodId: process.env.IFLOW_AUTH_METHOD_ID };
    }
    if (process.env.IFLOW_API_KEY) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, apiKey: process.env.IFLOW_API_KEY };
    }
    if (process.env.IFLOW_MODEL_NAME) {
        config.iflow = { ...config.iflow ?? defaultConfig.iflow, modelName: process.env.IFLOW_MODEL_NAME };
    }
    // 模型配置
    if (process.env.IFLOW_DEFAULT_MODEL) {
        config.models = { ...defaultConfig.models, default: process.env.IFLOW_DEFAULT_MODEL };
    }
    // 性能配置
    if (process.env.IFLOW_MAX_CONNECTIONS) {
        config.performance = {
            ...defaultConfig.performance,
            maxConnections: parseInt(process.env.IFLOW_MAX_CONNECTIONS, 10),
        };
    }
    if (process.env.IFLOW_STREAM_BUFFER_MS) {
        config.performance = {
            ...config.performance ?? defaultConfig.performance,
            streamBufferMs: parseInt(process.env.IFLOW_STREAM_BUFFER_MS, 10),
        };
    }
    return config;
}
// 从配置文件加载
function loadFromFile(configPath) {
    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch (error) {
        console.warn(`Failed to load config file: ${configPath}`, error);
    }
    return null;
}
// 深度合并配置
function mergeConfig(base, ...overrides) {
    let result = { ...base };
    for (const override of overrides) {
        if (override.server) {
            result.server = { ...result.server, ...override.server };
        }
        if (override.iflow) {
            result.iflow = { ...result.iflow, ...override.iflow };
        }
        if (override.models) {
            result.models = { ...result.models, ...override.models };
        }
        if (override.performance) {
            result.performance = { ...result.performance, ...override.performance };
        }
    }
    return result;
}
// 加载完整配置
function loadConfig(configPath) {
    const envConfig = loadFromEnv();
    const configFiles = [
        configPath,
        path.join(process.cwd(), 'iflow-proxy.config.json'),
        path.join(process.cwd(), '.iflow-proxy.json'),
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.iflow-proxy.json'),
    ].filter(Boolean);
    let fileConfig = null;
    for (const file of configFiles) {
        fileConfig = loadFromFile(file);
        if (fileConfig) {
            console.log(`Loaded config from: ${file}`);
            break;
        }
    }
    return mergeConfig(defaultConfig, fileConfig || {}, envConfig);
}
// 解析模型别名
function resolveModel(modelAlias, config) {
    const mapping = config.models.mappings.find(m => m.alias === modelAlias);
    return mapping ? mapping.actualModel : modelAlias;
}
// 获取模型配置
function getModelConfig(modelAlias, config) {
    return config.models.mappings.find(m => m.alias === modelAlias);
}
//# sourceMappingURL=config.js.map
# iFlow OpenAI Proxy

OpenAI 兼容 API 代理服务器，由 iFlow CLI ACP 驱动。将 iFlow CLI 的能力通过标准 OpenAI API 暴露，支持与任何 OpenAI 兼容的客户端集成。

## 特性

- 🔄 **OpenAI 兼容 API** - 完全兼容 OpenAI Chat Completions API
- 🤖 **动态模型支持** - 自动从 iFlow CLI 获取可用模型列表
- 🌊 **流式响应** - 支持 SSE (Server-Sent Events) 流式输出
- 🔌 **连接池** - 高性能连接复用，提升并发处理能力
- ⚙️ **灵活配置** - 支持环境变量、配置文件、命令行参数

## 系统要求

- Node.js >= 22.0.0
- iFlow CLI >= 0.2.0

## 安装

```bash
# 安装依赖
npm install

# 构建
npm run build
```

## 快速开始

### 1. 启动 iFlow CLI ACP 服务

```bash
iflow --experimental-acp --port 8090 --stream
```

### 2. 启动代理服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 指定端口
npm start -- --port 8080

# 启用调试日志
npm start -- --debug
```

### 3. 使用 API

```bash
# 获取模型列表
curl http://localhost:3000/v1/models

# 非流式请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4.7",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 流式请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4.7",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

## 支持的模型

模型列表动态从 iFlow CLI 获取，当前支持的模型包括：

| 模型 ID | 名称 | 说明 |
|---------|------|------|
| `glm-4.7` | GLM-4.7(推荐) | 支持思考模式 |
| `glm-5` | GLM-5 | 支持思考模式 |
| `deepseek-v3.2-chat` | DeepSeek-V3.2 | 支持思考模式 |
| `qwen3-coder-plus` | Qwen3-Coder-Plus | 代码优化 |
| `kimi-k2-thinking` | Kimi-K2-Thinking | 支持思考模式 |
| `kimi-k2.5` | Kimi-K2.5 | 支持思考模式 |
| `minimax-m2.5` | MiniMax-M2.5 | - |
| `iFlow-ROME-30BA3B` | iFlow-ROME-30BA3B(预览版) | - |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/v1/models` | GET | 获取模型列表 |
| `/v1/models/:model` | GET | 获取单个模型信息 |
| `/v1/chat/completions` | POST | 聊天完成请求 |

## 配置

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `IFLOW_PROXY_PORT` | 服务器端口 | 3000 |
| `IFLOW_PROXY_HOST` | 服务器主机 | 0.0.0.0 |
| `IFLOW_BASE_URL` | iFlow CLI WebSocket URL | ws://localhost:8090/acp |
| `IFLOW_PORT` | iFlow CLI 端口 | 8090 |
| `IFLOW_TIMEOUT` | 请求超时(毫秒) | 120000 |
| `IFLOW_DEBUG` | 启用调试日志 | false |
| `IFLOW_DEFAULT_MODEL` | 默认模型 | gpt-4 |
| `IFLOW_MAX_CONNECTIONS` | 最大连接数 | 100 |
| `IFLOW_AUTH_METHOD_ID` | 认证方法ID | - |
| `IFLOW_API_KEY` | API密钥 | - |
| `IFLOW_MODEL_NAME` | 模型名称 | - |

### 配置文件

在项目目录或用户主目录创建 `iflow-proxy.config.json` 或 `.iflow-proxy.json`：

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": true,
    "corsOrigins": ["*"]
  },
  "iflow": {
    "baseUrl": "ws://localhost:8090/acp",
    "port": 8090,
    "timeout": 120000,
    "debugLogging": false
  },
  "models": {
    "default": "glm-4.7"
  },
  "performance": {
    "maxConnections": 100,
    "requestTimeout": 300000,
    "streamBufferMs": 50
  }
}
```

### 命令行参数

```bash
iflow-proxy [options]

选项:
  -p, --port <port>           服务器端口
  -h, --host <host>           服务器主机
  --iflow-url <url>           iFlow CLI WebSocket URL
  --iflow-port <port>         iFlow CLI 端口
  --timeout <ms>              请求超时(毫秒)
  --max-connections <n>       最大并发连接数
  --debug                     启用调试日志
  --help                      显示帮助信息
```

## 与 OpenAI SDK 集成

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="not-needed"  # 不需要真实API密钥
)

response = client.chat.completions.create(
    model="glm-4.7",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)
```

### JavaScript/TypeScript

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'not-needed',
});

const response = await client.chat.completions.create({
  model: 'glm-4.7',
  messages: [{ role: 'user', content: '你好' }],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## 项目结构

```
iflow-openai-proxy/
├── src/
│   ├── index.ts           # 模块导出入口
│   ├── cli.ts             # CLI 入口
│   ├── server.ts          # HTTP 服务器
│   ├── config.ts          # 配置管理
│   ├── iflow-bridge.ts    # iFlow CLI 桥接
│   ├── openai-types.ts    # OpenAI 类型定义
│   └── handlers/
│       ├── chat.ts        # Chat Completions 处理器
│       └── models.ts      # Models 处理器
├── dist/                  # 编译输出
├── package.json
└── tsconfig.json
```

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 清理
npm run clean
```

## 许可证

MIT

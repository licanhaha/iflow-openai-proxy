/**
 * OpenAI API 类型定义
 * 兼容 OpenAI Chat Completions API
 */

// 模型配置接口
export interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
}

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';

// 消息内容类型
export type ContentType = 'text' | 'image_url';

// 内容部分
export interface ContentPart {
  type: ContentType;
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

// 消息接口
export interface ChatMessage {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// 函数调用
export interface FunctionCall {
  name: string;
  arguments: string;
}

// 工具调用
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

// 工具定义
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// 聊天完成请求
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: ToolDefinition[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
}

// 聊天完成响应（非流式）
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

// 选择项
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: unknown;
}

// 流式响应块
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  system_fingerprint?: string;
}

// 流式选择项
export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: MessageRole;
    content?: string;
    function_call?: Partial<FunctionCall>;
    tool_calls?: Partial<ToolCall>[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: unknown;
}

// 模型列表响应
export interface ModelsResponse {
  object: 'list';
  data: ModelConfig[];
}

// 错误响应
export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}

// API错误类型
export class OpenAIError extends Error {
  public type: string;
  public code?: string;
  public param?: string;
  public statusCode: number;

  constructor(message: string, type: string, statusCode: number = 500, code?: string, param?: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.code = code;
    this.param = param;
    this.statusCode = statusCode;
  }

  toResponse(): ErrorResponse {
    return {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
        param: this.param,
      },
    };
  }
}

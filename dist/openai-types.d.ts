/**
 * OpenAI API 类型定义
 * 兼容 OpenAI Chat Completions API
 */
export interface ModelConfig {
    id: string;
    name: string;
    description?: string;
    maxTokens?: number;
    supportsStreaming?: boolean;
    supportsVision?: boolean;
    supportsFunctionCalling?: boolean;
}
export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';
export type ContentType = 'text' | 'image_url';
export interface ContentPart {
    type: ContentType;
    text?: string;
    image_url?: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}
export interface ChatMessage {
    role: MessageRole;
    content: string | ContentPart[];
    name?: string;
    function_call?: FunctionCall;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface FunctionCall {
    name: string;
    arguments: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: FunctionCall;
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}
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
    tool_choice?: 'none' | 'auto' | 'required' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    response_format?: {
        type: 'text' | 'json_object';
    };
    seed?: number;
}
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
export interface ChatCompletionChoice {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    logprobs?: unknown;
}
export interface ChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: ChatCompletionChunkChoice[];
    system_fingerprint?: string;
}
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
export interface ModelsResponse {
    object: 'list';
    data: ModelConfig[];
}
export interface ErrorResponse {
    error: {
        message: string;
        type: string;
        code?: string;
        param?: string;
    };
}
export declare class OpenAIError extends Error {
    type: string;
    code?: string;
    param?: string;
    statusCode: number;
    constructor(message: string, type: string, statusCode?: number, code?: string, param?: string);
    toResponse(): ErrorResponse;
}
//# sourceMappingURL=openai-types.d.ts.map
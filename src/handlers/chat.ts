/**
 * Chat Completions 处理器
 * 实现 OpenAI Chat Completions API 端点
 */

import type { Response } from 'express';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk, ChatMessage } from '../openai-types';
import { OpenAIError } from '../openai-types';
import { IFlowBridge } from '../iflow-bridge';
import { resolveModel } from '../config';
import type { AppConfig } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class ChatHandler {
  private bridge: IFlowBridge;
  private config: AppConfig;

  constructor(bridge: IFlowBridge, config: AppConfig) {
    this.bridge = bridge;
    this.config = config;
  }

  /**
   * 处理 Chat Completions 请求
   */
  async handleChatCompletion(req: { body: ChatCompletionRequest }, res: Response): Promise<void> {
    try {
      const request = req.body;
      
      // 验证请求
      this.validateRequest(request);

      // 解析模型
      const actualModel = resolveModel(request.model, this.config);
      
      // 是否流式响应
      const stream = request.stream ?? false;

      if (stream) {
        await this.handleStreamingRequest(request, actualModel, res);
      } else {
        await this.handleNonStreamingRequest(request, actualModel, res);
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * 验证请求
   */
  private validateRequest(request: ChatCompletionRequest): void {
    if (!request.model) {
      throw new OpenAIError('Missing required field: model', 'invalid_request_error', 400);
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new OpenAIError('Missing required field: messages', 'invalid_request_error', 400);
    }

    for (const msg of request.messages) {
      if (!msg.role) {
        throw new OpenAIError('Missing role in message', 'invalid_request_error', 400);
      }
      if (!msg.content && !msg.tool_calls && !msg.function_call) {
        throw new OpenAIError('Message must have content, tool_calls, or function_call', 'invalid_request_error', 400);
      }
    }
  }

  /**
   * 处理非流式请求
   */
  private async handleNonStreamingRequest(
    request: ChatCompletionRequest,
    model: string,
    res: Response
  ): Promise<void> {
    try {
      const { text, finishReason } = await this.bridge.chatCompletion(request);

      const response: ChatCompletionResponse = {
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: text,
          },
          finish_reason: finishReason as 'stop' | 'length',
        }],
        usage: {
          prompt_tokens: this.estimateTokens(request.messages),
          completion_tokens: this.estimateTokens([{ role: 'assistant', content: text }]),
          total_tokens: this.estimateTokens(request.messages) + this.estimateTokens([{ role: 'assistant', content: text }]),
        },
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * 处理流式请求
   */
  private async handleStreamingRequest(
    request: ChatCompletionRequest,
    model: string,
    res: Response
  ): Promise<void> {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送初始角色块
    const responseId = `chatcmpl-${uuidv4()}`;
    const initialChunk: ChatCompletionChunk = {
      id: responseId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null,
      }],
    };
    this.sendSSE(res, initialChunk);

    try {
      await this.bridge.chatCompletion(request, (chunk: ChatCompletionChunk) => {
        this.sendSSE(res, chunk);
      });

      // 发送 [DONE] 标记
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * 发送 SSE 消息
   */
  private sendSSE(res: Response, data: ChatCompletionChunk): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown, res: Response): void {
    if (error instanceof OpenAIError) {
      res.status(error.statusCode).json(error.toResponse());
    } else if (error instanceof Error) {
      const openaiError = new OpenAIError(
        error.message,
        'internal_error',
        500
      );
      res.status(500).json(openaiError.toResponse());
    } else {
      const err = error as Error;
      res.status(500).json({
        error: {
          message: err?.message || 'Unknown error',
          type: 'internal_error',
        },
      });
    }
  }

  /**
   * 估算 token 数量（简单估算）
   */
  private estimateTokens(messages: ChatMessage[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((c: { type: string; text?: string }) => c.text || '').join('');
      totalChars += content.length;
      totalChars += msg.role.length;
    }
    // 粗略估算：4个字符约等于1个token
    return Math.ceil(totalChars / 4);
  }
}

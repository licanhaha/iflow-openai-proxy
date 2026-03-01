"use strict";
/**
 * OpenAI API 类型定义
 * 兼容 OpenAI Chat Completions API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIError = void 0;
// API错误类型
class OpenAIError extends Error {
    type;
    code;
    param;
    statusCode;
    constructor(message, type, statusCode = 500, code, param) {
        super(message);
        this.name = 'OpenAIError';
        this.type = type;
        this.code = code;
        this.param = param;
        this.statusCode = statusCode;
    }
    toResponse() {
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
exports.OpenAIError = OpenAIError;
//# sourceMappingURL=openai-types.js.map
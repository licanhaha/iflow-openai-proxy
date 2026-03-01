"use strict";
/**
 * CLI 入口
 * 命令行启动工具
 */
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const config_1 = require("./config");
// 显示帮助信息
function showHelp() {
    console.log(`
iFlow OpenAI Proxy - OpenAI-compatible API proxy powered by iFlow CLI

Usage: iflow-proxy [options]

Options:
  -p, --port <port>        Server port (default: 3000)
  -h, --host <host>        Server host (default: 0.0.0.0)
  --iflow-url <url>        iFlow CLI WebSocket URL (default: ws://localhost:8090/acp)
  --iflow-port <port>      iFlow CLI port (default: 8090)
  --timeout <ms>           Request timeout in milliseconds (default: 120000)
  --max-connections <n>    Maximum concurrent connections (default: 100)
  --debug                  Enable debug logging
  --help                   Show this help message

Environment Variables:
  IFLOW_PROXY_PORT         Server port
  IFLOW_PROXY_HOST         Server host
  IFLOW_BASE_URL           iFlow CLI WebSocket URL
  IFLOW_PORT               iFlow CLI port
  IFLOW_TIMEOUT            Request timeout
  IFLOW_DEBUG              Enable debug logging (true/false)
  IFLOW_DEFAULT_MODEL      Default model name
  IFLOW_MAX_CONNECTIONS    Maximum concurrent connections

Configuration File:
  The proxy will look for configuration files in the following order:
  1. iflow-proxy.config.json (current directory)
  2. .iflow-proxy.json (current directory)
  3. ~/.iflow-proxy.json (home directory)

Examples:
  iflow-proxy
  iflow-proxy --port 8080 --debug
  iflow-proxy --iflow-url ws://localhost:9090/acp
`);
}
// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-p':
            case '--port':
                result.port = args[++i];
                break;
            case '-h':
            case '--host':
                result.host = args[++i];
                break;
            case '--iflow-url':
                result.iflowUrl = args[++i];
                break;
            case '--iflow-port':
                result.iflowPort = args[++i];
                break;
            case '--timeout':
                result.timeout = args[++i];
                break;
            case '--max-connections':
                result.maxConnections = args[++i];
                break;
            case '--debug':
                result.debug = true;
                break;
            case '--help':
                result.help = true;
                break;
            default:
                console.warn(`Unknown argument: ${arg}`);
        }
    }
    return result;
}
// 应用命令行参数到环境变量
function applyArgsToEnv(args) {
    if (args.port)
        process.env.IFLOW_PROXY_PORT = args.port;
    if (args.host)
        process.env.IFLOW_PROXY_HOST = args.host;
    if (args.iflowUrl)
        process.env.IFLOW_BASE_URL = args.iflowUrl;
    if (args.iflowPort)
        process.env.IFLOW_PORT = args.iflowPort;
    if (args.timeout)
        process.env.IFLOW_TIMEOUT = args.timeout;
    if (args.maxConnections)
        process.env.IFLOW_MAX_CONNECTIONS = args.maxConnections;
    if (args.debug)
        process.env.IFLOW_DEBUG = 'true';
}
// 主函数
async function main() {
    const args = parseArgs();
    if (args.help) {
        showHelp();
        process.exit(0);
    }
    applyArgsToEnv(args);
    console.log('🔧 Loading configuration...');
    const config = (0, config_1.loadConfig)();
    console.log('🚀 Starting iFlow OpenAI Proxy...');
    const server = new server_1.Server(config);
    // 优雅关闭
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await server.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await server.start();
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map
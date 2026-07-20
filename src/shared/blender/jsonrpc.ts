/**
 * JSON-RPC 2.0 型定義（Blender WebSocket ブリッジ共通）
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export function isJsonRpcError(res: JsonRpcResponse): res is JsonRpcError {
  return 'error' in res;
}

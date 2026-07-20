using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace UnityAIController.Editor
{
    /// <summary>
    /// Unity Editor 内で動作する WebSocket サーバー。
    /// Controller からの JSON-RPC リクエストを受け取り、Editor API ハンドラへディスパッチします。
    /// </summary>
    [InitializeOnLoad]
    public static class UnityAiBridgeServer
    {
        private const int DefaultPort = 8765;
        private static HttpListener _listener;
        private static CancellationTokenSource _cts;
        private static readonly ConcurrentQueue<Action> MainThreadActions = new ConcurrentQueue<Action>();
        private static bool _started;

        static UnityAiBridgeServer()
        {
            EditorApplication.update += PumpMainThread;
            EditorApplication.delayCall += StartServer;
        }

        [MenuItem("Unity AI Controller/Start Bridge")]
        public static void StartServer()
        {
            if (_started)
            {
                return;
            }

            try
            {
                _cts = new CancellationTokenSource();
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://127.0.0.1:{DefaultPort}/unity/");
                _listener.Start();
                _started = true;
                Task.Run(() => AcceptLoopAsync(_cts.Token));
                Debug.Log($"[UnityAIController] Bridge listening on ws://127.0.0.1:{DefaultPort}/unity/");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[UnityAIController] Failed to start bridge: {ex.Message}");
            }
        }

        [MenuItem("Unity AI Controller/Stop Bridge")]
        public static void StopServer()
        {
            _cts?.Cancel();
            _listener?.Stop();
            _listener?.Close();
            _listener = null;
            _started = false;
            Debug.Log("[UnityAIController] Bridge stopped.");
        }

        private static async Task AcceptLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && _listener != null && _listener.IsListening)
            {
                HttpListenerContext context;
                try
                {
                    context = await _listener.GetContextAsync().ConfigureAwait(false);
                }
                catch
                {
                    break;
                }

                if (!context.Request.IsWebSocketRequest)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    continue;
                }

                var wsContext = await context.AcceptWebSocketAsync(null).ConfigureAwait(false);
                _ = Task.Run(() => HandleClientAsync(wsContext.WebSocket, token), token);
            }
        }

        private static async Task HandleClientAsync(WebSocket socket, CancellationToken token)
        {
            var buffer = new byte[64 * 1024];
            try
            {
                while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
                {
                    var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }

                    var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    var responseJson = await DispatchOnMainThreadAsync(json).ConfigureAwait(false);
                    var bytes = Encoding.UTF8.GetBytes(responseJson);
                    await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token)
                        .ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[UnityAIController] Client disconnected: {ex.Message}");
            }
            finally
            {
                socket.Dispose();
            }
        }

        private static Task<string> DispatchOnMainThreadAsync(string requestJson)
        {
            var tcs = new TaskCompletionSource<string>();
            MainThreadActions.Enqueue(() =>
            {
                try
                {
                    var response = RpcDispatcher.Dispatch(requestJson);
                    tcs.TrySetResult(response);
                }
                catch (Exception ex)
                {
                    tcs.TrySetResult(RpcDispatcher.ErrorResponse(null, -32603, ex.Message));
                }
            });
            return tcs.Task;
        }

        private static void PumpMainThread()
        {
            while (MainThreadActions.TryDequeue(out var action))
            {
                try
                {
                    action();
                }
                catch (Exception ex)
                {
                    Debug.LogException(ex);
                }
            }
        }
    }
}

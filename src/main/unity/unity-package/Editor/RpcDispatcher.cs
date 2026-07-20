using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using UnityEditor.Animations;
#if UNITY_EDITOR
#endif

namespace UnityAIController.Editor
{
    /// <summary>
    /// JSON-RPC リクエストを Unity Editor API 呼び出しへ変換するディスパッチャ。
    /// </summary>
    public static class RpcDispatcher
    {
        public static string Dispatch(string requestJson)
        {
            var request = MiniJson.Deserialize(requestJson) as Dictionary<string, object>;
            if (request == null)
            {
                return ErrorResponse(null, -32700, "Parse error");
            }

            var id = request.ContainsKey("id") ? request["id"]?.ToString() : null;
            var method = request.ContainsKey("method") ? request["method"]?.ToString() : null;
            var parameters = request.ContainsKey("params") ? request["params"] as Dictionary<string, object> : null;
            parameters = parameters ?? new Dictionary<string, object>();

            try
            {
                object result = method switch
                {
                    "system.ping" => new Dictionary<string, object> { ["pong"] = true, ["time"] = DateTime.UtcNow.ToString("O") },
                    "editor.getState" => EditorHandlers.GetState(),
                    "project.save" => EditorHandlers.SaveProject(),
                    "package.add" => EditorHandlers.AddPackage(GetString(parameters, "packageId")),
                    "scene.new" => EditorHandlers.NewScene(),
                    "scene.save" => EditorHandlers.SaveScene(),
                    "scene.open" => EditorHandlers.OpenScene(GetString(parameters, "path")),
                    "hierarchy.create" => EditorHandlers.CreateGameObject(parameters),
                    "hierarchy.delete" => EditorHandlers.DeleteGameObject(GetString(parameters, "name")),
                    "hierarchy.rename" => EditorHandlers.RenameGameObject(GetString(parameters, "name"), GetString(parameters, "newName")),
                    "hierarchy.find" => EditorHandlers.FindGameObject(GetString(parameters, "name")),
                    "hierarchy.duplicate" => EditorHandlers.DuplicateGameObject(GetString(parameters, "name")),
                    "hierarchy.setParent" => EditorHandlers.SetParent(GetString(parameters, "child"), GetString(parameters, "parent")),
                    "component.add" => EditorHandlers.AddComponent(GetString(parameters, "target"), GetString(parameters, "componentType")),
                    "component.remove" => EditorHandlers.RemoveComponent(GetString(parameters, "target"), GetString(parameters, "componentType")),
                    "asset.createPrefab" => EditorHandlers.CreatePrefab(GetString(parameters, "name"), GetString(parameters, "path")),
                    "asset.createMaterial" => EditorHandlers.CreateMaterial(GetString(parameters, "name"), GetString(parameters, "path")),
                    "asset.createAnimatorController" => EditorHandlers.CreateAnimatorController(GetString(parameters, "name"), GetString(parameters, "path")),
                    "ui.generateMenu" => EditorHandlers.GenerateMenuUi(parameters),
                    "build.player" => EditorHandlers.BuildPlayer(parameters),
                    "console.getEntries" => EditorHandlers.GetConsoleEntries(GetInt(parameters, "limit", 50)),
                    "script.applyFix" => EditorHandlers.ApplyScriptFix(GetString(parameters, "filePath"), GetString(parameters, "newContent")),
                    _ => throw new InvalidOperationException($"Unknown method: {method}")
                };

                return SuccessResponse(id, result);
            }
            catch (Exception ex)
            {
                return ErrorResponse(id, -32000, ex.Message);
            }
        }

        public static string SuccessResponse(string id, object result)
        {
            var dict = new Dictionary<string, object>
            {
                ["jsonrpc"] = "2.0",
                ["id"] = id,
                ["result"] = result
            };
            return MiniJson.Serialize(dict);
        }

        public static string ErrorResponse(string id, int code, string message)
        {
            var dict = new Dictionary<string, object>
            {
                ["jsonrpc"] = "2.0",
                ["id"] = id,
                ["error"] = new Dictionary<string, object>
                {
                    ["code"] = code,
                    ["message"] = message
                }
            };
            return MiniJson.Serialize(dict);
        }

        private static string GetString(Dictionary<string, object> p, string key)
            => p.ContainsKey(key) && p[key] != null ? p[key].ToString() : null;

        private static int GetInt(Dictionary<string, object> p, string key, int fallback)
        {
            if (!p.ContainsKey(key) || p[key] == null) return fallback;
            if (p[key] is long l) return (int)l;
            if (p[key] is double d) return (int)d;
            return int.TryParse(p[key].ToString(), out var v) ? v : fallback;
        }
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build.Reporting;
using UnityEditor.PackageManager;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace UnityAIController.Editor
{
    /// <summary>
    /// Unity Editor API を直接呼び出すハンドラ群。
    /// GUI クリックではなく公式 API を優先します。
    /// </summary>
    public static class EditorHandlers
    {
        public static Dictionary<string, object> GetState()
        {
            var scene = SceneManager.GetActiveScene();
            return new Dictionary<string, object>
            {
                ["projectPath"] = Directory.GetParent(Application.dataPath)?.FullName,
                ["projectName"] = Application.productName,
                ["unityVersion"] = Application.unityVersion,
                ["activeScene"] = scene.path,
                ["isCompiling"] = EditorApplication.isCompiling,
                ["hierarchyObjectCount"] = UnityEngine.Object.FindObjectsOfType<GameObject>().Length,
                ["recentConsoleEntries"] = GetConsoleEntries(10),
                ["updatedAt"] = DateTime.UtcNow.ToString("O")
            };
        }

        public static Dictionary<string, object> SaveProject()
        {
            AssetDatabase.SaveAssets();
            EditorApplication.ExecuteMenuItem("File/Save Project");
            return new Dictionary<string, object> { ["saved"] = true };
        }

        public static Dictionary<string, object> AddPackage(string packageId)
        {
            if (string.IsNullOrEmpty(packageId))
            {
                throw new ArgumentException("packageId is required");
            }

            Client.Add(packageId);
            return new Dictionary<string, object> { ["packageId"] = packageId, ["status"] = "requested" };
        }

        public static Dictionary<string, object> NewScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            return new Dictionary<string, object> { ["scene"] = scene.name };
        }

        public static Dictionary<string, object> SaveScene()
        {
            var scene = SceneManager.GetActiveScene();
            if (string.IsNullOrEmpty(scene.path))
            {
                var path = EditorUtility.SaveFilePanelInProject("Save Scene", "NewScene", "unity", "Save scene");
                if (string.IsNullOrEmpty(path))
                {
                    throw new InvalidOperationException("Scene save cancelled");
                }

                EditorSceneManager.SaveScene(scene, path);
                return new Dictionary<string, object> { ["path"] = path };
            }

            EditorSceneManager.SaveScene(scene);
            return new Dictionary<string, object> { ["path"] = scene.path };
        }

        public static Dictionary<string, object> OpenScene(string path)
        {
            if (string.IsNullOrEmpty(path))
            {
                throw new ArgumentException("path is required");
            }

            EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
            return new Dictionary<string, object> { ["path"] = path };
        }

        public static Dictionary<string, object> CreateGameObject(Dictionary<string, object> parameters)
        {
            var name = GetString(parameters, "name") ?? "GameObject";
            var primitive = GetString(parameters, "primitive");
            var count = GetInt(parameters, "count", 1);
            var tag = GetString(parameters, "tag");
            var created = new List<string>();

            for (var i = 0; i < count; i++)
            {
                GameObject go;
                if (!string.IsNullOrEmpty(primitive) && Enum.TryParse(primitive, true, out PrimitiveType p))
                {
                    go = GameObject.CreatePrimitive(p);
                    go.name = count > 1 ? $"{name}_{i + 1}" : name;
                }
                else
                {
                    go = new GameObject(count > 1 ? $"{name}_{i + 1}" : name);
                }

                if (!string.IsNullOrEmpty(tag))
                {
                    try { go.tag = tag; } catch { /* tag may not exist */ }
                }

                if (parameters.ContainsKey("components") && parameters["components"] is List<object> comps)
                {
                    foreach (var c in comps)
                    {
                        AddComponentInternal(go, c?.ToString());
                    }
                }

                Undo.RegisterCreatedObjectUndo(go, "Create " + go.name);
                created.Add(go.name);
                if (count > 1)
                {
                    go.transform.position = new Vector3(i * 2f, 0, 0);
                }
            }

            return new Dictionary<string, object> { ["created"] = created };
        }

        public static Dictionary<string, object> DeleteGameObject(string name)
        {
            var go = GameObject.Find(name);
            if (go == null) throw new InvalidOperationException($"GameObject not found: {name}");
            Undo.DestroyObjectImmediate(go);
            return new Dictionary<string, object> { ["deleted"] = name };
        }

        public static Dictionary<string, object> RenameGameObject(string name, string newName)
        {
            var go = GameObject.Find(name);
            if (go == null) throw new InvalidOperationException($"GameObject not found: {name}");
            Undo.RecordObject(go, "Rename");
            go.name = newName;
            return new Dictionary<string, object> { ["name"] = newName };
        }

        public static Dictionary<string, object> FindGameObject(string name)
        {
            var go = GameObject.Find(name);
            return new Dictionary<string, object>
            {
                ["found"] = go != null,
                ["name"] = go != null ? go.name : null,
                ["instanceId"] = go != null ? go.GetInstanceID() : 0
            };
        }

        public static Dictionary<string, object> DuplicateGameObject(string name)
        {
            var go = GameObject.Find(name);
            if (go == null) throw new InvalidOperationException($"GameObject not found: {name}");
            var copy = UnityEngine.Object.Instantiate(go);
            copy.name = go.name + "_Copy";
            Undo.RegisterCreatedObjectUndo(copy, "Duplicate");
            return new Dictionary<string, object> { ["name"] = copy.name };
        }

        public static Dictionary<string, object> SetParent(string childName, string parentName)
        {
            var child = GameObject.Find(childName);
            var parent = GameObject.Find(parentName);
            if (child == null || parent == null)
            {
                throw new InvalidOperationException("child or parent not found");
            }

            Undo.SetTransformParent(child.transform, parent.transform, "Set Parent");
            return new Dictionary<string, object> { ["child"] = childName, ["parent"] = parentName };
        }

        public static Dictionary<string, object> AddComponent(string target, string componentType)
        {
            var go = GameObject.Find(target);
            if (go == null) throw new InvalidOperationException($"GameObject not found: {target}");
            AddComponentInternal(go, componentType);
            return new Dictionary<string, object> { ["target"] = target, ["componentType"] = componentType };
        }

        public static Dictionary<string, object> RemoveComponent(string target, string componentType)
        {
            var go = GameObject.Find(target);
            if (go == null) throw new InvalidOperationException($"GameObject not found: {target}");
            var type = FindType(componentType);
            var comp = go.GetComponent(type);
            if (comp == null) throw new InvalidOperationException("Component not found");
            Undo.DestroyObjectImmediate(comp);
            return new Dictionary<string, object> { ["removed"] = componentType };
        }

        public static Dictionary<string, object> CreatePrefab(string name, string path)
        {
            name = string.IsNullOrEmpty(name) ? "NewPrefab" : name;
            path = string.IsNullOrEmpty(path) ? $"Assets/{name}.prefab" : path;
            var go = new GameObject(name);
            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            UnityEngine.Object.DestroyImmediate(go);
            return new Dictionary<string, object> { ["path"] = path, ["name"] = prefab.name };
        }

        public static Dictionary<string, object> CreateMaterial(string name, string path)
        {
            name = string.IsNullOrEmpty(name) ? "NewMaterial" : name;
            path = string.IsNullOrEmpty(path) ? $"Assets/{name}.mat" : path;
            var mat = new Material(Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit"));
            AssetDatabase.CreateAsset(mat, path);
            AssetDatabase.SaveAssets();
            return new Dictionary<string, object> { ["path"] = path };
        }

        public static Dictionary<string, object> CreateAnimatorController(string name, string path)
        {
            name = string.IsNullOrEmpty(name) ? "NewAnimatorController" : name;
            path = string.IsNullOrEmpty(path) ? $"Assets/{name}.controller" : path;
            var controller = AnimatorController.CreateAnimatorControllerAtPath(path);
            return new Dictionary<string, object> { ["path"] = path, ["name"] = controller.name };
        }

        public static Dictionary<string, object> GenerateMenuUi(Dictionary<string, object> parameters)
        {
            var title = GetString(parameters, "title") ?? "Game Title";
            var buttons = new List<string> { "Start", "Options", "Quit" };
            if (parameters.ContainsKey("buttons") && parameters["buttons"] is List<object> list)
            {
                buttons = list.Select(x => x?.ToString() ?? "Button").ToList();
            }

            // Canvas
            var canvasGo = new GameObject("MenuCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            Undo.RegisterCreatedObjectUndo(canvasGo, "Create MenuCanvas");

            // EventSystem
            if (UnityEngine.Object.FindObjectOfType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
                Undo.RegisterCreatedObjectUndo(es, "Create EventSystem");
            }

            // Panel + Vertical Layout
            var panel = new GameObject("Panel", typeof(RectTransform), typeof(Image), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            panel.transform.SetParent(canvasGo.transform, false);
            var panelRt = panel.GetComponent<RectTransform>();
            panelRt.anchorMin = new Vector2(0.5f, 0.5f);
            panelRt.anchorMax = new Vector2(0.5f, 0.5f);
            panelRt.sizeDelta = new Vector2(420, 360);
            panel.GetComponent<Image>().color = new Color(0, 0, 0, 0.65f);
            var layout = panel.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 12;
            layout.padding = new RectOffset(24, 24, 24, 24);
            layout.childAlignment = TextAnchor.MiddleCenter;
            layout.childControlHeight = true;
            layout.childControlWidth = true;
            layout.childForceExpandHeight = false;
            layout.childForceExpandWidth = true;
            panel.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            // Title
            var titleGo = CreateUiText(panel.transform, "Title", title, 36);

            // Buttons
            foreach (var label in buttons)
            {
                CreateUiButton(panel.transform, label);
            }

            return new Dictionary<string, object>
            {
                ["canvas"] = canvasGo.name,
                ["title"] = title,
                ["buttons"] = buttons
            };
        }

        public static Dictionary<string, object> BuildPlayer(Dictionary<string, object> parameters)
        {
            var targetName = GetString(parameters, "target") ?? "StandaloneWindows64";
            var outputPath = GetString(parameters, "outputPath") ?? "Builds/Output";
            if (!Enum.TryParse(targetName, out BuildTarget target))
            {
                throw new ArgumentException($"Unknown build target: {targetName}");
            }

            // Android keystore (optional)
            if (target == BuildTarget.Android)
            {
                var keystorePath = GetString(parameters, "keystorePath");
                if (!string.IsNullOrEmpty(keystorePath))
                {
                    PlayerSettings.Android.useCustomKeystore = true;
                    PlayerSettings.Android.keystoreName = keystorePath;
                    PlayerSettings.Android.keystorePass = GetString(parameters, "keystorePass") ?? string.Empty;
                    PlayerSettings.Android.keyaliasName = GetString(parameters, "keyaliasName") ?? string.Empty;
                    PlayerSettings.Android.keyaliasPass = GetString(parameters, "keyaliasPass") ?? string.Empty;
                }
            }

            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (scenes.Length == 0)
            {
                var active = SceneManager.GetActiveScene().path;
                if (!string.IsNullOrEmpty(active))
                {
                    scenes = new[] { active };
                }
            }

            var options = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputPath,
                target = target,
                options = BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(options);
            return new Dictionary<string, object>
            {
                ["result"] = report.summary.result.ToString(),
                ["outputPath"] = outputPath,
                ["totalErrors"] = report.summary.totalErrors,
                ["totalSize"] = report.summary.totalSize.ToString()
            };
        }

        public static List<object> GetConsoleEntries(int limit)
        {
            var results = new List<object>();
            try
            {
                var logEntriesType = Type.GetType("UnityEditor.LogEntries,UnityEditor.dll");
                var logEntryType = Type.GetType("UnityEditor.LogEntry,UnityEditor.dll");
                if (logEntriesType == null || logEntryType == null)
                {
                    return results;
                }

                var getCount = logEntriesType.GetMethod("GetCount", BindingFlags.Static | BindingFlags.Public);
                var getEntry = logEntriesType.GetMethod("GetEntryInternal", BindingFlags.Static | BindingFlags.Public);
                var startGetting = logEntriesType.GetMethod("StartGettingEntries", BindingFlags.Static | BindingFlags.Public);
                var endGetting = logEntriesType.GetMethod("EndGettingEntries", BindingFlags.Static | BindingFlags.Public);
                var count = (int)(getCount?.Invoke(null, null) ?? 0);
                startGetting?.Invoke(null, null);
                var entry = Activator.CreateInstance(logEntryType);
                var messageField = logEntryType.GetField("message");
                var modeField = logEntryType.GetField("mode");
                var take = Math.Min(limit, count);
                for (var i = count - take; i < count; i++)
                {
                    getEntry?.Invoke(null, new object[] { i, entry });
                    var message = messageField?.GetValue(entry)?.ToString() ?? string.Empty;
                    var mode = modeField != null ? Convert.ToInt32(modeField.GetValue(entry)) : 0;
                    var type = (mode & 1) != 0 ? "Error" : (mode & 2) != 0 ? "Warning" : "Log";
                    results.Add(new Dictionary<string, object>
                    {
                        ["id"] = i.ToString(),
                        ["type"] = type,
                        ["message"] = message,
                        ["stackTrace"] = null,
                        ["timestamp"] = DateTime.UtcNow.ToString("O")
                    });
                }

                endGetting?.Invoke(null, null);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[UnityAIController] Console read failed: {ex.Message}");
            }

            return results;
        }

        public static Dictionary<string, object> ApplyScriptFix(string filePath, string newContent)
        {
            if (string.IsNullOrEmpty(filePath))
            {
                throw new ArgumentException("filePath is required");
            }

            if (string.IsNullOrEmpty(newContent))
            {
                throw new InvalidOperationException("Proposed content is empty. Manual edit required.");
            }

            var fullPath = Path.IsPathRooted(filePath)
                ? filePath
                : Path.Combine(Directory.GetParent(Application.dataPath)!.FullName, filePath);

            File.WriteAllText(fullPath, newContent);
            AssetDatabase.Refresh();
            return new Dictionary<string, object> { ["applied"] = true, ["path"] = filePath };
        }

        private static void AddComponentInternal(GameObject go, string componentType)
        {
            if (string.IsNullOrEmpty(componentType)) return;
            var type = FindType(componentType);
            if (type == null) throw new InvalidOperationException($"Type not found: {componentType}");
            Undo.AddComponent(go, type);
        }

        private static Type FindType(string typeName)
        {
            var type = Type.GetType(typeName);
            if (type != null) return type;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                type = asm.GetType(typeName);
                if (type != null) return type;
                type = asm.GetTypes().FirstOrDefault(t => t.Name == typeName);
                if (type != null) return type;
            }

            return null;
        }

        private static GameObject CreateUiText(Transform parent, string name, string text, int fontSize)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.text = text;
            t.fontSize = fontSize;
            t.alignment = TextAnchor.MiddleCenter;
            t.color = Color.white;
            t.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            var le = go.AddComponent<LayoutElement>();
            le.preferredHeight = fontSize + 20;
            return go;
        }

        private static GameObject CreateUiButton(Transform parent, string label)
        {
            var go = new GameObject(label + "Button", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = new Color(0.2f, 0.45f, 0.85f, 1f);
            go.GetComponent<LayoutElement>().preferredHeight = 44;
            var textGo = new GameObject("Text", typeof(RectTransform), typeof(Text));
            textGo.transform.SetParent(go.transform, false);
            var rt = textGo.GetComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            var text = textGo.GetComponent<Text>();
            text.text = label;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = Color.white;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = 20;
            return go;
        }

        private static string GetString(Dictionary<string, object> p, string key)
            => p != null && p.ContainsKey(key) && p[key] != null ? p[key].ToString() : null;

        private static int GetInt(Dictionary<string, object> p, string key, int fallback)
        {
            if (p == null || !p.ContainsKey(key) || p[key] == null) return fallback;
            if (p[key] is long l) return (int)l;
            if (p[key] is double d) return (int)d;
            return int.TryParse(p[key].ToString(), out var v) ? v : fallback;
        }
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace UnityAIController.Editor
{
    /// <summary>
    /// Unity 互換の軽量 JSON パーサ/シリアライザ（外部依存なし）。
    /// </summary>
    public static class MiniJson
    {
        public static object Deserialize(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            return Parser.Parse(json);
        }

        public static string Serialize(object obj)
        {
            var sb = new StringBuilder();
            SerializeValue(obj, sb);
            return sb.ToString();
        }

        private static void SerializeValue(object value, StringBuilder sb)
        {
            if (value == null) { sb.Append("null"); return; }
            if (value is string s) { SerializeString(s, sb); return; }
            if (value is bool b) { sb.Append(b ? "true" : "false"); return; }
            if (value is IDictionary dict)
            {
                sb.Append('{');
                var first = true;
                foreach (DictionaryEntry kv in dict)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    SerializeString(kv.Key.ToString(), sb);
                    sb.Append(':');
                    SerializeValue(kv.Value, sb);
                }
                sb.Append('}');
                return;
            }

            if (value is IList list)
            {
                sb.Append('[');
                var first = true;
                foreach (var item in list)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    SerializeValue(item, sb);
                }
                sb.Append(']');
                return;
            }

            if (value is int or long or float or double or decimal)
            {
                sb.Append(Convert.ToString(value, CultureInfo.InvariantCulture));
                return;
            }

            SerializeString(value.ToString(), sb);
        }

        private static void SerializeString(string str, StringBuilder sb)
        {
            sb.Append('"');
            foreach (var c in str)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ') sb.AppendFormat("\\u{0:X4}", (int)c);
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        private sealed class Parser
        {
            private readonly string _json;
            private int _index;

            private Parser(string json) { _json = json; }

            public static object Parse(string json) => new Parser(json).ParseValue();

            private object ParseValue()
            {
                EatWhitespace();
                if (_index >= _json.Length) return null;
                return _json[_index] switch
                {
                    '"' => ParseString(),
                    '{' => ParseObject(),
                    '[' => ParseArray(),
                    't' => ParseLiteral("true", true),
                    'f' => ParseLiteral("false", false),
                    'n' => ParseLiteral("null", null),
                    _ => ParseNumber()
                };
            }

            private Dictionary<string, object> ParseObject()
            {
                var dict = new Dictionary<string, object>();
                _index++; // {
                while (true)
                {
                    EatWhitespace();
                    if (_index >= _json.Length) break;
                    if (_json[_index] == '}') { _index++; break; }
                    var key = ParseString();
                    EatWhitespace();
                    _index++; // :
                    var value = ParseValue();
                    dict[key] = value;
                    EatWhitespace();
                    if (_index < _json.Length && _json[_index] == ',') _index++;
                }
                return dict;
            }

            private List<object> ParseArray()
            {
                var list = new List<object>();
                _index++; // [
                while (true)
                {
                    EatWhitespace();
                    if (_index >= _json.Length) break;
                    if (_json[_index] == ']') { _index++; break; }
                    list.Add(ParseValue());
                    EatWhitespace();
                    if (_index < _json.Length && _json[_index] == ',') _index++;
                }
                return list;
            }

            private string ParseString()
            {
                var sb = new StringBuilder();
                _index++; // "
                while (_index < _json.Length)
                {
                    var c = _json[_index++];
                    if (c == '"') break;
                    if (c == '\\' && _index < _json.Length)
                    {
                        var esc = _json[_index++];
                        sb.Append(esc switch
                        {
                            '"' => '"',
                            '\\' => '\\',
                            '/' => '/',
                            'n' => '\n',
                            'r' => '\r',
                            't' => '\t',
                            'u' => (char)Convert.ToInt32(_json.Substring(_index, 4), 16),
                            _ => esc
                        });
                        if (esc == 'u') _index += 4;
                    }
                    else sb.Append(c);
                }
                return sb.ToString();
            }

            private object ParseNumber()
            {
                var start = _index;
                while (_index < _json.Length && "0123456789+-.eE".IndexOf(_json[_index]) >= 0) _index++;
                var num = _json.Substring(start, _index - start);
                if (num.IndexOf('.') >= 0 || num.IndexOf('e') >= 0 || num.IndexOf('E') >= 0)
                {
                    return double.Parse(num, CultureInfo.InvariantCulture);
                }
                return long.Parse(num, CultureInfo.InvariantCulture);
            }

            private object ParseLiteral(string literal, object value)
            {
                _index += literal.Length;
                return value;
            }

            private void EatWhitespace()
            {
                while (_index < _json.Length && char.IsWhiteSpace(_json[_index])) _index++;
            }
        }
    }
}

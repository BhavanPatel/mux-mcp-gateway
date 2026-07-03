"""Parse JSONC (JSON with comments) — strips // comments respecting string boundaries."""
import json, re, sys

def strip_jsonc(content: str) -> str:
    result = []
    i = 0
    in_string = False
    while i < len(content):
        c = content[i]
        if in_string:
            result.append(c)
            if c == '\\' and i + 1 < len(content):
                i += 1
                result.append(content[i])
            elif c == '"':
                in_string = False
        else:
            if c == '"':
                in_string = True
                result.append(c)
            elif c == '/' and i + 1 < len(content) and content[i+1] == '/':
                while i < len(content) and content[i] != '\n':
                    i += 1
                continue
            else:
                result.append(c)
        i += 1
    content = ''.join(result)
    content = re.sub(r',\s*([}\]])', r'\1', content)
    return content

def load_jsonc(path: str) -> dict:
    with open(path) as f:
        return json.loads(strip_jsonc(f.read()))

if __name__ == '__main__':
    print(json.dumps(load_jsonc(sys.argv[1])))

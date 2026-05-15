#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
import pathlib
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_LOCAL_UPLOAD_BYTES = 500 * 1024 * 1024
OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"
ALLOWED_MODELS = {
    "gpt-4o-mini-transcribe",
    "gpt-4o-transcribe",
    "gpt-4o-transcribe-diarize",
    "whisper-1",
}
ALLOWED_LOCAL_MODELS = {"tiny", "base", "small", "medium", "large-v3"}
LOCAL_MODEL_CACHE = {}


class VoxNoteHandler(SimpleHTTPRequestHandler):
    server_version = "VoxNoteHTTP/0.1"

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/status":
            self.send_json(engine_status())
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/api/transcribe":
            self.send_json({"error": "Unknown endpoint"}, status=404)
            return

        self.handle_transcribe(parsed)

    def handle_transcribe(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        engine = query.get("engine", ["local"])[0]
        if engine not in {"local", "cloud"}:
            engine = "local"

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0:
            self.send_json({"error": "没有收到音频或视频数据。"}, status=400)
            return

        if engine == "cloud":
            self.handle_cloud_transcribe(query, length)
            return

        self.handle_local_transcribe(query, length)

    def handle_cloud_transcribe(self, query, length):
        api_key = self.headers.get("X-OpenAI-API-Key") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            self.send_json(
                {
                    "error": "云端转录需要 API key。请在设置里保存 key，或设置 OPENAI_API_KEY。",
                    "hint": "OPENAI_API_KEY=sk-... python3 server.py --port 5173",
                },
                status=500,
            )
            return

        if length > MAX_UPLOAD_BYTES:
            self.send_json({"error": "云端转录文件超过 25 MB，请先压缩或裁剪。"}, status=413)
            return

        body = self.rfile.read(length)
        model = query.get("model", ["gpt-4o-mini-transcribe"])[0]
        language = query.get("language", [""])[0]
        if model not in ALLOWED_MODELS:
            model = "gpt-4o-mini-transcribe"

        response_format = "json"
        if model == "gpt-4o-transcribe-diarize":
            response_format = "diarized_json"
        elif model == "whisper-1":
            response_format = "verbose_json"

        raw_filename = self.headers.get("X-Filename", "audio.webm")
        filename = pathlib.Path(urllib.parse.unquote(raw_filename)).name or "audio.webm"
        content_type = self.headers.get("Content-Type", "application/octet-stream")

        fields = {
            "model": model,
            "response_format": response_format,
        }
        if language:
            fields["language"] = language

        multipart_body, multipart_type = build_multipart(
            fields=fields,
            file_field="file",
            filename=filename,
            file_content_type=content_type,
            file_bytes=body,
        )

        request = urllib.request.Request(
            OPENAI_TRANSCRIBE_URL,
            data=multipart_body,
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": multipart_type,
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                response_body = response.read()
                response_text = response_body.decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            self.send_json({"error": detail or str(error)}, status=error.code)
            return
        except Exception as error:
            self.send_json({"error": str(error)}, status=502)
            return

        try:
            raw = json.loads(response_text)
        except json.JSONDecodeError:
            raw = {"text": response_text}

        text = extract_text(raw)
        self.send_json(
            {
                "text": text,
                "model": model,
                "response_format": response_format,
                "filename": filename,
                "engine": "cloud",
                "raw": raw,
            }
        )

    def handle_local_transcribe(self, query, length):
        status = engine_status()
        if not status["local"]["available"]:
            self.drain_upload(length)
            self.send_json(
                {
                    "error": "本地转录引擎还没安装。请安装 faster-whisper，或切换到云端 API。",
                    "hint": "python3 -m pip install faster-whisper",
                    "status": status,
                },
                status=500,
            )
            return

        if length > MAX_LOCAL_UPLOAD_BYTES:
            self.drain_upload(length)
            self.send_json({"error": "本地转录文件超过 500 MB，请先裁剪。"}, status=413)
            return

        model_name = query.get("model", ["base"])[0]
        language = query.get("language", [""])[0] or None
        if model_name not in ALLOWED_LOCAL_MODELS:
            model_name = "base"

        raw_filename = self.headers.get("X-Filename", "audio.webm")
        filename = pathlib.Path(urllib.parse.unquote(raw_filename)).name or "audio.webm"
        suffix = pathlib.Path(filename).suffix or ".webm"

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_path = pathlib.Path(temp_file.name)
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    temp_file.write(chunk)
                    remaining -= len(chunk)

            raw = local_transcribe(temp_path, model_name, language)
        except Exception as error:
            self.send_json({"error": str(error)}, status=500)
            return
        finally:
            if temp_path:
                temp_path.unlink(missing_ok=True)

        self.send_json(
            {
                "text": extract_text(raw),
                "model": model_name,
                "filename": filename,
                "engine": "local",
                "raw": raw,
            }
        )

    def drain_upload(self, length):
        remaining = length
        while remaining:
            chunk = self.rfile.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            remaining -= len(chunk)

    def send_json(self, payload, status=200):
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def build_multipart(fields, file_field, filename, file_content_type, file_bytes):
    boundary = f"----VoxNote{uuid.uuid4().hex}"
    chunks = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    safe_filename = filename.replace('"', "")
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{safe_filename}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {file_content_type}\r\n\r\n".encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def extract_text(raw):
    if isinstance(raw, dict):
        if isinstance(raw.get("text"), str):
            return raw["text"].strip()

        segments = raw.get("segments")
        if isinstance(segments, list):
            return "\n".join(
                str(segment.get("text") or segment.get("transcript") or "").strip()
                for segment in segments
                if isinstance(segment, dict)
            ).strip()

        utterances = raw.get("utterances")
        if isinstance(utterances, list):
            return "\n".join(
                str(item.get("text") or item.get("transcript") or "").strip()
                for item in utterances
                if isinstance(item, dict)
            ).strip()

    return str(raw).strip()


def engine_status():
    faster_whisper = importlib.util.find_spec("faster_whisper") is not None
    whisper = importlib.util.find_spec("whisper") is not None
    return {
        "cloud": {
            "api_key": bool(os.environ.get("OPENAI_API_KEY")),
            "max_upload_mb": MAX_UPLOAD_BYTES // 1024 // 1024,
        },
        "local": {
            "available": faster_whisper or whisper,
            "faster_whisper": faster_whisper,
            "whisper": whisper,
            "ffmpeg": shutil.which("ffmpeg") is not None,
            "max_upload_mb": MAX_LOCAL_UPLOAD_BYTES // 1024 // 1024,
        },
    }


def local_transcribe(path, model_name, language):
    if importlib.util.find_spec("faster_whisper") is not None:
        return transcribe_with_faster_whisper(path, model_name, language)

    if importlib.util.find_spec("whisper") is not None:
        return transcribe_with_openai_whisper(path, model_name, language)

    raise RuntimeError("本地转录引擎不可用。")


def transcribe_with_faster_whisper(path, model_name, language):
    from faster_whisper import WhisperModel

    cache_key = ("faster_whisper", model_name)
    if cache_key not in LOCAL_MODEL_CACHE:
        device = os.environ.get("VOXNOTE_WHISPER_DEVICE", "auto")
        compute_type = os.environ.get("VOXNOTE_WHISPER_COMPUTE_TYPE", "int8")
        LOCAL_MODEL_CACHE[cache_key] = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
        )

    model = LOCAL_MODEL_CACHE[cache_key]
    segment_iter, info = model.transcribe(
        str(path),
        language=language,
        vad_filter=True,
        beam_size=5,
    )
    segments = [
        {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
        }
        for segment in segment_iter
    ]
    return {
        "text": "\n".join(segment["text"] for segment in segments).strip(),
        "segments": segments,
        "language": getattr(info, "language", language),
        "duration": getattr(info, "duration", None),
        "backend": "faster-whisper",
    }


def transcribe_with_openai_whisper(path, model_name, language):
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("openai-whisper 需要系统安装 ffmpeg。建议安装 faster-whisper。")

    import whisper

    cache_key = ("whisper", model_name)
    if cache_key not in LOCAL_MODEL_CACHE:
        LOCAL_MODEL_CACHE[cache_key] = whisper.load_model(model_name)

    model = LOCAL_MODEL_CACHE[cache_key]
    result = model.transcribe(str(path), language=language)
    return {
        "text": str(result.get("text", "")).strip(),
        "segments": result.get("segments", []),
        "language": result.get("language", language),
        "backend": "whisper",
    }


def main():
    parser = argparse.ArgumentParser(description="Serve VoxNote and its transcription API.")
    parser.add_argument("--port", type=int, default=5173)
    parser.add_argument("--host", default="localhost")
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parent
    os.chdir(root)
    server = ThreadingHTTPServer((args.host, args.port), VoxNoteHandler)
    print(f"VoxNote serving on http://{args.host}:{args.port}", file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()

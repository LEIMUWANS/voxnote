# VoxNote

一个轻量的网页端语音转文字 MVP。第一版使用浏览器内置的 `SpeechRecognition` 做实时麦克风识别，并用 `MediaRecorder` 保存录音文件。

项目现在已经预留桌面应用骨架，目标是用 Tauri 打包成 macOS 和 Windows 安装包，并通过 GitHub Releases 分发。

## 使用

仅体验界面和浏览器实时听写，可以直接打开 `index.html`。

要使用本地音视频文件转录、系统声音捕获后的转录，需要启动本地服务：

```bash
python3 server.py --port 5173
```

然后访问 `http://localhost:5173`。

## 转录引擎

### 本地免费

本地转录不需要 API 费用。推荐安装 `faster-whisper`：

```bash
python3 -m pip install faster-whisper
```

如果只安装了 `openai-whisper`，还需要系统里有 `ffmpeg`。`faster-whisper` 对本地音视频更省事。

### 云端 API

云端转录需要 OpenAI API key，按用量计费。可以在应用「设置」里保存用户自己的 key；开发时也可以启动服务前设置环境变量：

```bash
OPENAI_API_KEY=sk-... python3 server.py --port 5173
```

界面里切到「云端 API」后才会调用云端。

网页 MVP 会把设置里的 API key 保存在当前设备的浏览器本地存储中。桌面正式版会改为系统钥匙串或凭据管理器。

## 桌面应用

当前已加入 Tauri 工程骨架：

```bash
npm install
npm run desktop:dev
```

正式打包：

```bash
npm run desktop:build
```

注意：现在的桌面骨架还没有内置 `whisper.cpp` 和 `ffmpeg` sidecar。第一阶段会先用于打包 UI；后续会把本地转录引擎和媒体处理工具作为内置二进制随安装包一起发布。

## GitHub 发布

`.github/workflows/release.yml` 已经预留 GitHub Actions 发布流程。后续推送版本标签时会自动构建 macOS/Windows 安装包并上传到 draft release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布细节见 `docs/github-release-guide.md`。

跨平台功能检查见 `docs/compatibility-checklist.md`。

## 当前能力

- 实时麦克风转写
- 上传本地音频和视频文件转写
- 捕获系统声音并转写
- 支持普通话、粤语、英文、日文、韩文语言选项
- 支持本地免费 Whisper / faster-whisper 转录
- 支持 `gpt-4o-mini-transcribe`、`gpt-4o-transcribe`、`gpt-4o-transcribe-diarize` 和 `whisper-1`
- 设置界面：默认引擎、本地模型、云端 API key、主题、字号
- 录音保存和回放
- 手动编辑转写稿
- 自动保存草稿
- 视图模式、紧凑默认布局、字号和深色模式
- 录音音量反馈
- 分段筛选、定位、复制、删除
- 文本整理和插入时间戳
- 复制文本
- 导出 TXT
- 导出带粗略时间轴的 SRT

## 常见失败原因

如果拖入文件后点击「转录文件」显示失败，通常是下面几种情况：

- 当前选择「本地免费」，但本地 Whisper 引擎还没安装或桌面版还没内置 sidecar。
- 当前选择「云端 API」，但没有设置 `OPENAI_API_KEY`。
- 没有通过 `python3 server.py --port 5173` 启动本地服务。
- 云端模式下文件超过 25 MB。
- 本地模式下文件格式需要后续内置 `ffmpeg` 才能稳定处理。

当前开发阶段，文件预览和上传入口已经完成；真正“免安装”的本地转录会在桌面版内置 `whisper.cpp` 和媒体处理 sidecar 后完成。

## 后续桌面版方向

- 用 Electron 或 Tauri 封装当前网页
- 接入 OpenAI/Whisper 或本地模型，支持上传音频转写
- 增加说话人分离、会议纪要、字幕校准

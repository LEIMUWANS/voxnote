const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const els = {
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  languageSelect: document.querySelector("#languageSelect"),
  continuousToggle: document.querySelector("#continuousToggle"),
  interimToggle: document.querySelector("#interimToggle"),
  micPermissionText: document.querySelector("#micPermissionText"),
  micCheckButton: document.querySelector("#micCheckButton"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  clearButton: document.querySelector("#clearButton"),
  engineStatusText: document.querySelector("#engineStatusText"),
  engineTypeButtons: [...document.querySelectorAll("[data-engine-type]")],
  engineModel: document.querySelector("#engineModel"),
  localModel: document.querySelector("#localModel"),
  jobStatusText: document.querySelector("#jobStatusText"),
  jobProgress: document.querySelector("#jobProgress"),
  jobDetailText: document.querySelector("#jobDetailText"),
  fileStatusText: document.querySelector("#fileStatusText"),
  fileDrop: document.querySelector("#fileDrop"),
  mediaFileInput: document.querySelector("#mediaFileInput"),
  filePreview: document.querySelector("#filePreview"),
  mediaPreview: document.querySelector("#mediaPreview"),
  fileMetaText: document.querySelector("#fileMetaText"),
  transcribeFileButton: document.querySelector("#transcribeFileButton"),
  systemStatusText: document.querySelector("#systemStatusText"),
  startSystemButton: document.querySelector("#startSystemButton"),
  stopSystemButton: document.querySelector("#stopSystemButton"),
  systemPreview: document.querySelector("#systemPreview"),
  systemPlayback: document.querySelector("#systemPlayback"),
  transcribeSystemButton: document.querySelector("#transcribeSystemButton"),
  copyButton: document.querySelector("#copyButton"),
  downloadTxtButton: document.querySelector("#downloadTxtButton"),
  downloadSrtButton: document.querySelector("#downloadSrtButton"),
  downloadAudioButton: document.querySelector("#downloadAudioButton"),
  timerText: document.querySelector("#timerText"),
  wordCount: document.querySelector("#wordCount"),
  segmentCount: document.querySelector("#segmentCount"),
  transcriptArea: document.querySelector("#transcriptArea"),
  interimText: document.querySelector("#interimText"),
  segmentsList: document.querySelector("#segmentsList"),
  segmentTemplate: document.querySelector("#segmentTemplate"),
  restoreButton: document.querySelector("#restoreButton"),
  audioSection: document.querySelector("#audioSection"),
  audioPlayback: document.querySelector("#audioPlayback"),
  levelText: document.querySelector("#levelText"),
  levelBars: [...document.querySelectorAll(".level-bars span")],
  viewButtons: [...document.querySelectorAll("[data-view-mode]")],
  fontSizeRange: document.querySelector("#fontSizeRange"),
  fontSizeValue: document.querySelector("#fontSizeValue"),
  themeButton: document.querySelector("#themeButton"),
  formatButton: document.querySelector("#formatButton"),
  timestampButton: document.querySelector("#timestampButton"),
  toggleSegmentsButton: document.querySelector("#toggleSegmentsButton"),
  segmentSearch: document.querySelector("#segmentSearch"),
  segmentMatchText: document.querySelector("#segmentMatchText"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  settingsModal: document.querySelector("#settingsModal"),
  settingsEngineText: document.querySelector("#settingsEngineText"),
  settingsEngineButtons: [...document.querySelectorAll("[data-settings-engine]")],
  settingsLocalModel: document.querySelector("#settingsLocalModel"),
  settingsEngineModel: document.querySelector("#settingsEngineModel"),
  apiKeyStatusText: document.querySelector("#apiKeyStatusText"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveApiKeyButton: document.querySelector("#saveApiKeyButton"),
  clearApiKeyButton: document.querySelector("#clearApiKeyButton"),
  refreshEngineButton: document.querySelector("#refreshEngineButton"),
  settingsFontSizeRange: document.querySelector("#settingsFontSizeRange"),
  settingsFontSizeValue: document.querySelector("#settingsFontSizeValue"),
  settingsThemeButton: document.querySelector("#settingsThemeButton"),
};

const storageKey = "voxnote.transcript.v1";
const settingsKey = "voxnote.settings.v1";
let recognition = null;
let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let analyser = null;
let levelFrame = 0;
let audioChunks = [];
let audioBlob = null;
let audioUrl = "";
let selectedFile = null;
let selectedFileUrl = "";
let systemStream = null;
let systemRecorder = null;
let systemChunks = [];
let systemBlob = null;
let systemAudioUrl = "";
let isListening = false;
let shouldRestart = false;
let startedAt = 0;
let timerId = 0;
let segments = [];
let activeSegmentIndex = -1;
let settings = {
  view: "balanced",
  density: "compact",
  theme: "light",
  fontSize: 16,
  engine: "local",
  localModel: "base",
  cloudModel: "gpt-4o-mini-transcribe",
  apiKey: "",
};
let lastEngineStatus = null;

const languageMap = {
  "zh-CN": "zh",
  "zh-HK": "zh",
  "en-GB": "en",
  "en-US": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
};

function setStatus(text, tone = "idle") {
  els.statusText.textContent = text;
  els.statusDot.classList.toggle("is-live", tone === "live");
  els.statusDot.classList.toggle("is-ready", tone === "ready");
}

function setMicPermission(text, tone = "idle") {
  els.micPermissionText.textContent = text;
  els.micPermissionText.dataset.tone = tone;
}

function micErrorMessage(error) {
  const name = error?.name || "";
  const messages = {
    NotAllowedError: "权限被拒绝",
    SecurityError: "权限被阻止",
    NotFoundError: "没有麦克风",
    DevicesNotFoundError: "没有麦克风",
    NotReadableError: "设备被占用",
    TrackStartError: "设备被占用",
    AbortError: "请求中断",
    OverconstrainedError: "设备不匹配",
  };
  return messages[name] || "麦克风不可用";
}

function micErrorHint(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "请在浏览器地址栏或系统隐私设置里允许麦克风";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "没有检测到可用麦克风";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风可能被其他应用占用";
  }
  if (!window.isSecureContext) {
    return "请通过 localhost、HTTPS 或桌面 App 打开";
  }
  return "请检查浏览器和系统权限";
}

async function updateMicPermissionState() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMicPermission("浏览器不支持", "blocked");
    return;
  }

  if (!window.isSecureContext) {
    setMicPermission("非安全环境", "blocked");
    return;
  }

  if (!navigator.permissions?.query) {
    setMicPermission("点击检查", "idle");
    return;
  }

  try {
    const permission = await navigator.permissions.query({ name: "microphone" });
    applyMicPermissionState(permission.state);
    permission.onchange = () => applyMicPermissionState(permission.state);
  } catch {
    setMicPermission("点击检查", "idle");
  }
}

function applyMicPermissionState(state) {
  if (state === "granted") setMicPermission("已授权", "ready");
  else if (state === "denied") setMicPermission("已阻止", "blocked");
  else setMicPermission("未请求", "idle");
}

async function requestMicrophoneAccess({ keepStream = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMicPermission("浏览器不支持", "blocked");
    throw new Error("当前环境不支持麦克风访问");
  }

  if (!window.isSecureContext) {
    setMicPermission("非安全环境", "blocked");
    throw new Error("麦克风需要 localhost、HTTPS 或桌面 App 环境");
  }

  setMicPermission("请求中", "idle");
  setStatus("请求麦克风权限", "idle");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setMicPermission("已授权", "ready");
    if (keepStream) return stream;

    for (const track of stream.getTracks()) {
      track.stop();
    }
    setStatus("麦克风可用", "ready");
    showToast("麦克风可用");
    return null;
  } catch (error) {
    const message = micErrorMessage(error);
    setMicPermission(message, "blocked");
    setStatus(message, "idle");
    showToast(micErrorHint(error));
    throw error;
  }
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatTimestamp(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatSrtTime(ms) {
  const total = Math.max(0, Math.floor(ms));
  const hours = String(Math.floor(total / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  const millis = String(total % 1000).padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${millis}`;
}

function currentElapsed() {
  return startedAt ? Date.now() - startedAt : 0;
}

function getTranscriptText() {
  return els.transcriptArea.value.trim();
}

function updateMetrics() {
  const text = getTranscriptText();
  const compactCjk = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  const words = text
    .replace(/[\u3400-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  els.wordCount.textContent = String(compactCjk + words);
  els.segmentCount.textContent = String(segments.length);
}

function persistSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(settingsKey) || "null");
  } catch {
    return null;
  }
}

function applySettings() {
  document.body.dataset.view = settings.view;
  document.body.dataset.density = settings.density;
  document.body.dataset.theme = settings.theme;
  els.transcriptArea.style.fontSize = `${settings.fontSize}px`;
  els.fontSizeRange.value = String(settings.fontSize);
  els.fontSizeValue.textContent = String(settings.fontSize);
  els.settingsFontSizeRange.value = String(settings.fontSize);
  els.settingsFontSizeValue.textContent = String(settings.fontSize);
  els.themeButton.querySelector("span:last-child").textContent =
    settings.theme === "dark" ? "浅色" : "深色";
  els.settingsThemeButton.querySelector("span:last-child").textContent =
    settings.theme === "dark" ? "浅色" : "深色";
  els.engineModel.value = settings.cloudModel;
  els.settingsEngineModel.value = settings.cloudModel;
  els.localModel.value = settings.localModel;
  els.settingsLocalModel.value = settings.localModel;
  els.settingsEngineText.textContent = engineLabel(settings.engine);
  els.apiKeyStatusText.textContent = settings.apiKey ? "已保存" : "未保存";
  els.apiKeyStatusText.dataset.tone = settings.apiKey ? "ready" : "warn";
  els.apiKeyInput.placeholder = settings.apiKey ? "已保存，输入新 key 可替换" : "sk-...";

  for (const button of els.viewButtons) {
    button.classList.toggle("is-active", button.dataset.viewMode === settings.view);
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === settings.view));
  }

  for (const button of els.engineTypeButtons) {
    button.classList.toggle("is-active", button.dataset.engineType === settings.engine);
    button.setAttribute("aria-pressed", String(button.dataset.engineType === settings.engine));
  }

  for (const button of els.settingsEngineButtons) {
    button.classList.toggle("is-active", button.dataset.settingsEngine === settings.engine);
    button.setAttribute("aria-pressed", String(button.dataset.settingsEngine === settings.engine));
  }

  els.engineModel.disabled = settings.engine !== "cloud";
  els.settingsEngineModel.disabled = settings.engine !== "cloud";
  els.localModel.disabled = settings.engine !== "local";
  els.settingsLocalModel.disabled = settings.engine !== "local";
}

function persistDraft() {
  const payload = {
    text: els.transcriptArea.value,
    segments,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    return null;
  }
}

function restoreDraft() {
  const draft = readDraft();
  if (!draft) {
    showToast("没有可恢复的草稿");
    return;
  }

  els.transcriptArea.value = draft.text || "";
  segments = Array.isArray(draft.segments) ? draft.segments : [];
  activeSegmentIndex = -1;
  renderSegments();
  updateMetrics();
  showToast("已恢复草稿");
}

function appendFinalText(text) {
  const cleaned = text.trim();
  if (!cleaned) return;

  const current = els.transcriptArea.value.trimEnd();
  const separator = current ? "\n" : "";
  els.transcriptArea.value = `${current}${separator}${cleaned}`;
  els.transcriptArea.scrollTop = els.transcriptArea.scrollHeight;
  persistDraft();
}

function addSegment(text, confidence) {
  const start = currentElapsed();
  const duration = Math.max(1800, Math.min(7000, text.length * 180));
  segments.push({
    text: text.trim(),
    start,
    end: start + duration,
    confidence: Number.isFinite(confidence) ? confidence : null,
    source: "麦克风",
  });
  renderSegments();
  updateMetrics();
  persistDraft();
}

function addImportedTranscript(text, source) {
  const cleaned = text.trim();
  if (!cleaned) return;

  const heading = `【${source}】`;
  const current = els.transcriptArea.value.trimEnd();
  const next = current ? `${current}\n\n${heading}\n${cleaned}` : `${heading}\n${cleaned}`;
  els.transcriptArea.value = next;

  const chunks = cleaned
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const usableChunks = chunks.length ? chunks : [cleaned];
  let cursor = 0;

  for (const chunk of usableChunks) {
    const duration = Math.max(2200, Math.min(9000, chunk.length * 180));
    segments.push({
      text: chunk,
      start: cursor,
      end: cursor + duration,
      confidence: null,
      source,
    });
    cursor += duration;
  }

  activeSegmentIndex = -1;
  renderSegments();
  updateMetrics();
  persistDraft();
}

function renderSegments() {
  els.segmentsList.replaceChildren();
  const query = els.segmentSearch.value.trim().toLowerCase();
  let visibleCount = 0;

  for (const [index, segment] of segments.entries()) {
    const matches = !query || segment.text.toLowerCase().includes(query);
    const node = els.segmentTemplate.content.firstElementChild.cloneNode(true);
    const time = node.querySelector("time");
    const confidence = node.querySelector(".segment-meta span");
    const text = node.querySelector("p");

    node.dataset.index = String(index);
    node.classList.toggle("is-active", index === activeSegmentIndex);
    node.classList.toggle("is-hidden", !matches);
    time.textContent = formatTimestamp(segment.start);
    time.dateTime = `PT${Math.floor(segment.start / 1000)}S`;
    confidence.textContent =
      segment.confidence === null
        ? segment.source || "source --"
        : `confidence ${Math.round(segment.confidence * 100)}%`;
    text.textContent = segment.text;
    if (matches) visibleCount += 1;
    els.segmentsList.append(node);
  }

  els.segmentMatchText.textContent = `${visibleCount} / ${segments.length}`;
}

function setJobStatus(text, busy = false) {
  els.jobStatusText.textContent = text;
  els.jobProgress.classList.toggle("is-busy", busy);
  els.jobProgress.style.setProperty("--job-progress", busy ? "42%" : "0%");
}

function setJobDetail(text, tone = "idle") {
  els.jobDetailText.textContent = text;
  els.jobDetailText.dataset.tone = tone;
}

function setEngineStatus(text, tone = "idle") {
  els.engineStatusText.textContent = text;
  els.engineStatusText.dataset.tone = tone;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "--";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function currentLanguageCode() {
  return languageMap[els.languageSelect.value] || "";
}

function setSelectedFile(file) {
  selectedFile = file || null;
  revokeSelectedFileUrl();

  if (!selectedFile) {
    els.fileStatusText.textContent = "未选择";
    els.fileMetaText.textContent = "";
    els.mediaPreview.removeAttribute("src");
    els.filePreview.hidden = true;
    els.transcribeFileButton.disabled = true;
    setJobDetail("选择音频或视频文件后，可以用当前引擎转录。");
    return;
  }

  selectedFileUrl = URL.createObjectURL(selectedFile);
  els.mediaPreview.src = selectedFileUrl;
  els.filePreview.hidden = false;
  els.fileStatusText.textContent = "已选择";
  els.fileMetaText.textContent = `${selectedFile.name} · ${formatFileSize(selectedFile.size)} · ${
    selectedFile.type || "未知类型"
  }`;
  els.transcribeFileButton.disabled = false;
  setJobDetail("文件已就绪。点击“转录文件”前，请确认转录引擎状态可用。", "ready");
}

function revokeSelectedFileUrl() {
  if (selectedFileUrl) {
    URL.revokeObjectURL(selectedFileUrl);
    selectedFileUrl = "";
  }
}

function handleFileDrop(event) {
  event.preventDefault();
  els.fileDrop.classList.remove("is-dragging");
  const [file] = event.dataTransfer.files || [];
  if (file) setSelectedFile(file);
}

async function transcribeFile() {
  if (!selectedFile) {
    showToast("请先选择音频或视频文件");
    return;
  }

  await transcribeBlob(selectedFile, selectedFile.name, "本地文件");
}

async function transcribeSystemAudio() {
  if (!systemBlob) {
    showToast("还没有捕获到系统声音");
    return;
  }

  await transcribeBlob(systemBlob, "system-audio.webm", "系统声音");
}

async function transcribeBlob(blob, filename, sourceLabel) {
  if (!blob.size) {
    showToast("音频为空");
    return;
  }

  const preflight = await checkTranscriptionReadiness();
  if (!preflight.ok) {
    setJobStatus("无法转录", false);
    setJobDetail(preflight.message, "error");
    showToast(preflight.shortMessage);
    return;
  }

  const params = new URLSearchParams({
    engine: settings.engine,
    model: settings.engine === "cloud" ? settings.cloudModel : settings.localModel,
    language: currentLanguageCode(),
  });
  const headers = {
    "Content-Type": blob.type || "application/octet-stream",
    "X-Filename": encodeURIComponent(filename),
  };

  if (settings.engine === "cloud" && settings.apiKey) {
    headers["X-OpenAI-API-Key"] = settings.apiKey;
  }

  setJobStatus(settings.engine === "cloud" ? "上传中" : "本地处理中", true);
  setJobDetail(
    settings.engine === "cloud" ? "正在上传到云端转录服务。" : "正在调用本地转录引擎。",
    "ready",
  );
  disableTranscriptionActions(true);

  try {
    const response = await fetch(`/api/transcribe?${params.toString()}`, {
      method: "POST",
      headers,
      body: blob,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `转录失败 ${response.status}`);
    }

    const text = extractTranscriptText(payload);
    if (!text) throw new Error("没有收到可用的转写文本");

    addImportedTranscript(text, `${sourceLabel} · ${payload.engine === "local" ? "本地" : "云端"}`);
    setJobStatus("完成", false);
    setJobDetail("转录完成，结果已加入转写稿。", "ready");
    showToast("转录完成");
  } catch (error) {
    setJobStatus("失败", false);
    setJobDetail(error.message || "转录失败，请检查引擎和文件格式。", "error");
    showToast(error.message || "转录失败");
  } finally {
    disableTranscriptionActions(false);
  }
}

async function checkTranscriptionReadiness() {
  const status = await getEngineStatus();

  if (!status) {
    return {
      ok: false,
      shortMessage: "本地服务未启动",
      message: "转录服务没有响应。请先启动本地服务：python3 server.py --port 5173。",
    };
  }

  if (settings.engine === "local" && !status.local?.available) {
    return {
      ok: false,
      shortMessage: "本地引擎未安装",
      message:
        "当前选择的是“本地免费”，但这台机器还没有安装本地 Whisper 引擎。现在可以预览文件，但不能转录。后续桌面版会把本地引擎内置进安装包。",
    };
  }

  if (settings.engine === "cloud" && !status.cloud?.api_key && !settings.apiKey) {
    return {
      ok: false,
      shortMessage: "缺少 API key",
      message:
        "当前选择的是“云端 API”，但本地服务没有检测到 OPENAI_API_KEY。请设置 API key，或切回“本地免费”。",
    };
  }

  return { ok: true };
}

async function getEngineStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status unavailable");
    lastEngineStatus = await response.json();
    return lastEngineStatus;
  } catch {
    lastEngineStatus = null;
    return null;
  }
}

function extractTranscriptText(payload) {
  if (typeof payload.text === "string") return payload.text.trim();
  if (typeof payload.raw === "string") return payload.raw.trim();
  if (payload.raw && typeof payload.raw.text === "string") return payload.raw.text.trim();
  if (Array.isArray(payload.raw?.segments)) {
    return payload.raw.segments
      .map((segment) => segment.text || segment.transcript || "")
      .join("\n")
      .trim();
  }
  return "";
}

function disableTranscriptionActions(disabled) {
  els.transcribeFileButton.disabled = disabled || !selectedFile;
  els.transcribeSystemButton.disabled = disabled || !systemBlob;
  els.engineModel.disabled = disabled || settings.engine !== "cloud";
  els.settingsEngineModel.disabled = disabled || settings.engine !== "cloud";
  els.localModel.disabled = disabled || settings.engine !== "local";
  els.settingsLocalModel.disabled = disabled || settings.engine !== "local";
  for (const button of els.engineTypeButtons) {
    button.disabled = disabled;
  }
  for (const button of els.settingsEngineButtons) {
    button.disabled = disabled;
  }
}

async function startSystemCapture() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast("当前浏览器不支持系统声音捕获");
    return;
  }

  try {
    systemStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch {
    showToast("系统声音捕获已取消");
    return;
  }

  const audioTracks = systemStream.getAudioTracks();
  if (!audioTracks.length) {
    stopSystemTracks();
    showToast("没有捕获到系统声音，请在共享窗口时勾选音频");
    return;
  }

  revokeSystemAudioUrl();
  systemBlob = null;
  systemChunks = [];
  const audioOnlyStream = new MediaStream(audioTracks);

  try {
    systemRecorder = new MediaRecorder(audioOnlyStream);
  } catch {
    stopSystemTracks();
    showToast("系统声音录制不可用");
    return;
  }

  systemRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) systemChunks.push(event.data);
  };
  systemRecorder.onstop = () => {
    systemBlob = new Blob(systemChunks, { type: systemRecorder.mimeType || "audio/webm" });
    systemAudioUrl = URL.createObjectURL(systemBlob);
    els.systemPlayback.src = systemAudioUrl;
    els.systemPreview.hidden = false;
    els.transcribeSystemButton.disabled = false;
    els.systemStatusText.textContent = `${formatFileSize(systemBlob.size)}`;
    stopSystemTracks();
  };

  systemRecorder.start();
  els.systemStatusText.textContent = "捕获中";
  els.startSystemButton.disabled = true;
  els.stopSystemButton.disabled = false;
  els.transcribeSystemButton.disabled = true;
}

function stopSystemCapture() {
  if (systemRecorder && systemRecorder.state !== "inactive") {
    systemRecorder.stop();
  }
  els.startSystemButton.disabled = false;
  els.stopSystemButton.disabled = true;
}

function stopSystemTracks() {
  for (const track of systemStream?.getTracks() || []) {
    track.stop();
  }
  systemStream = null;
  els.startSystemButton.disabled = false;
  els.stopSystemButton.disabled = true;
}

function revokeSystemAudioUrl() {
  if (systemAudioUrl) {
    URL.revokeObjectURL(systemAudioUrl);
    systemAudioUrl = "";
  }
  els.systemPlayback.removeAttribute("src");
  els.systemPreview.hidden = true;
}

function configureRecognition() {
  recognition = new SpeechRecognition();
  recognition.lang = els.languageSelect.value;
  recognition.continuous = els.continuousToggle.checked;
  recognition.interimResults = els.interimToggle.checked;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    setStatus("正在听写", "live");
  };

  recognition.onresult = (event) => {
    let interim = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternative = result[0];
      const transcript = alternative.transcript;

      if (result.isFinal) {
        appendFinalText(transcript);
        addSegment(transcript, alternative.confidence);
      } else {
        interim += transcript;
      }
    }

    els.interimText.textContent = interim.trim();
    updateMetrics();
  };

  recognition.onerror = (event) => {
    const readable = {
      "not-allowed": "麦克风权限被拒绝",
      "audio-capture": "没有检测到麦克风",
      network: "识别服务连接失败",
      "no-speech": "没有检测到语音",
    };
    setStatus(readable[event.error] || "识别中断", "idle");
    if (event.error !== "no-speech") {
      shouldRestart = false;
    }
  };

  recognition.onend = () => {
    if (shouldRestart && isListening) {
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          setStatus("等待重新开始", "ready");
        }
      }, 240);
      return;
    }

    if (!isListening) {
      setStatus("已停止", "ready");
    }
  };
}

async function startRecording() {
  if (!SpeechRecognition) {
    setStatus("当前浏览器不支持", "idle");
    showToast("请使用 Chrome 或 Edge 打开这个页面");
    return;
  }

  if (isListening) return;

  try {
    mediaStream = await requestMicrophoneAccess({ keepStream: true });
  } catch {
    return;
  }

  audioChunks = [];
  audioBlob = null;
  revokeAudioUrl();
  startAudioMonitor(mediaStream);
  configureRecognition();

  try {
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      audioUrl = URL.createObjectURL(audioBlob);
      els.audioPlayback.src = audioUrl;
      els.audioSection.hidden = false;
    };
    mediaRecorder.start();
  } catch {
    mediaRecorder = null;
  }

  isListening = true;
  shouldRestart = els.continuousToggle.checked;
  startedAt = Date.now();
  els.startButton.disabled = true;
  els.stopButton.disabled = false;
  els.languageSelect.disabled = true;
  els.timerText.textContent = "00:00";
  timerId = window.setInterval(() => {
    els.timerText.textContent = formatTimer(currentElapsed());
  }, 250);

  try {
    recognition.start();
  } catch {
    stopRecording();
  }
}

function stopRecording() {
  if (!isListening) return;

  isListening = false;
  shouldRestart = false;
  els.interimText.textContent = "";
  els.startButton.disabled = false;
  els.stopButton.disabled = true;
  els.languageSelect.disabled = false;
  window.clearInterval(timerId);
  els.timerText.textContent = formatTimer(currentElapsed());

  try {
    recognition?.stop();
  } catch {
    setStatus("已停止", "ready");
  }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  for (const track of mediaStream?.getTracks() || []) {
    track.stop();
  }

  stopAudioMonitor();
  mediaStream = null;
}

function clearAll() {
  if (isListening) stopRecording();
  els.transcriptArea.value = "";
  els.interimText.textContent = "";
  segments = [];
  activeSegmentIndex = -1;
  localStorage.removeItem(storageKey);
  renderSegments();
  updateMetrics();
  setStatus("已清空", "ready");
}

function formatTranscript() {
  const text = els.transcriptArea.value;
  if (!text.trim()) {
    showToast("没有可整理的文本");
    return;
  }

  els.transcriptArea.value = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  updateMetrics();
  persistDraft();
  showToast("已整理");
}

function insertTimestamp() {
  const start = els.transcriptArea.selectionStart;
  const end = els.transcriptArea.selectionEnd;
  const before = els.transcriptArea.value.slice(0, start);
  const after = els.transcriptArea.value.slice(end);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const stamp = `${prefix}[${formatTimestamp(currentElapsed())}] `;
  els.transcriptArea.value = `${before}${stamp}${after}`;
  els.transcriptArea.focus();
  els.transcriptArea.setSelectionRange(start + stamp.length, start + stamp.length);
  updateMetrics();
  persistDraft();
}

function focusSegment(index) {
  const segment = segments[index];
  if (!segment) return;

  activeSegmentIndex = index;
  renderSegments();

  const position = els.transcriptArea.value.indexOf(segment.text);
  if (position >= 0) {
    els.transcriptArea.focus();
    els.transcriptArea.setSelectionRange(position, position + segment.text.length);
  }
}

async function copySegment(index) {
  const segment = segments[index];
  if (!segment) return;

  try {
    await navigator.clipboard.writeText(segment.text);
  } catch {
    await copyTranscript();
    return;
  }

  showToast("已复制分段");
}

function deleteSegment(index) {
  if (!segments[index]) return;
  segments.splice(index, 1);
  if (activeSegmentIndex === index) activeSegmentIndex = -1;
  if (activeSegmentIndex > index) activeSegmentIndex -= 1;
  renderSegments();
  updateMetrics();
  persistDraft();
}

function handleSegmentAction(event) {
  const button = event.target.closest("[data-segment-action]");
  const item = event.target.closest("li[data-index]");
  if (!item) return;

  const index = Number(item.dataset.index);
  if (!button) {
    focusSegment(index);
    return;
  }

  const action = button.dataset.segmentAction;
  if (action === "focus") focusSegment(index);
  if (action === "copy") copySegment(index);
  if (action === "delete") deleteSegment(index);
}

function setView(view) {
  if (settings.view === view) return;
  settings.view = view;
  applySettings();
  persistSettings();
  flashSegmentButton(els.viewButtons.find((button) => button.dataset.viewMode === view));
  showToast(`已切换为${viewLabel(view)}`);
}

function setEngine(engine) {
  if (settings.engine === engine) return;
  settings.engine = engine;
  applySettings();
  persistSettings();
  flashSegmentButton(els.engineTypeButtons.find((button) => button.dataset.engineType === engine));
  showToast(`已切换为${engineLabel(engine)}`);
  updateEngineStatus();
}

function setCloudModel(model) {
  settings.cloudModel = model;
  applySettings();
  persistSettings();
}

function setLocalModel(model) {
  settings.localModel = model;
  applySettings();
  persistSettings();
}

function setFontSize(size) {
  settings.fontSize = Number(size);
  applySettings();
  persistSettings();
}

function toggleTheme() {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  applySettings();
  persistSettings();
  showToast(`已切换为${settings.theme === "dark" ? "深色" : "浅色"}`);
}

function flashSegmentButton(button) {
  if (!button) return;

  button.classList.remove("just-activated");
  void button.offsetWidth;
  button.classList.add("just-activated");
  window.setTimeout(() => button.classList.remove("just-activated"), 420);
}

function viewLabel(view) {
  return {
    balanced: "均衡视图",
    focus: "专注视图",
    review: "复核视图",
  }[view] || "新视图";
}

function engineLabel(engine) {
  return {
    local: "本地免费",
    cloud: "云端 API",
  }[engine] || "新引擎";
}

function openSettings() {
  syncSettingsForm();
  els.settingsModal.hidden = false;
  els.closeSettingsButton.focus();
}

function closeSettings() {
  els.settingsModal.hidden = true;
  els.openSettingsButton.focus();
}

function syncSettingsForm() {
  els.apiKeyInput.value = "";
  applySettings();
}

function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    showToast("请输入 API key");
    return;
  }

  settings.apiKey = key;
  els.apiKeyInput.value = "";
  applySettings();
  persistSettings();
  updateEngineStatus();
  showToast("API key 已保存");
}

function clearApiKey() {
  settings.apiKey = "";
  els.apiKeyInput.value = "";
  applySettings();
  persistSettings();
  updateEngineStatus();
  showToast("API key 已清除");
}

async function updateEngineStatus() {
  const status = await getEngineStatus();
  if (!status) {
    setEngineStatus("需启动服务", "warn");
    setJobDetail("转录服务没有响应。文件可以预览，但无法转录。", "warn");
    return;
  }

  if (settings.engine === "cloud") {
    const hasKey = status.cloud?.api_key || Boolean(settings.apiKey);
    setEngineStatus(hasKey ? "API key 可用" : "需 API key", hasKey ? "ready" : "warn");
    setJobDetail(
      hasKey
        ? "云端 API key 已配置。选择文件后可以转录。"
        : "云端 API 需要在设置里保存 API key，或通过 OPENAI_API_KEY 启动服务。",
      hasKey ? "ready" : "warn",
    );
    return;
  }

  if (status.local?.available) {
    const backend = status.local.faster_whisper ? "faster-whisper" : "whisper";
    setEngineStatus(backend, "ready");
    setJobDetail("本地转录引擎可用。选择文件后可以离线转录。", "ready");
  } else {
    setEngineStatus("本地未安装", "warn");
    setJobDetail("本地引擎未安装。文件可以预览，但点转录会被拦截。", "warn");
  }
}

function startAudioMonitor(stream) {
  stopAudioMonitor();

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
  } catch {
    stopAudioMonitor();
    return;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    const level = Math.min(1, average / 128);
    const percent = Math.round(level * 100);
    els.levelText.textContent = `${percent}%`;

    els.levelBars.forEach((bar, index) => {
      const offset = Math.sin((Date.now() / 120 + index) * 0.85) * 0.16;
      const barLevel = Math.max(0.08, Math.min(1, level + offset));
      bar.style.setProperty("--level", `${Math.round(barLevel * 100)}%`);
      bar.classList.toggle("is-hot", index / els.levelBars.length < level);
    });

    levelFrame = requestAnimationFrame(draw);
  };

  draw();
}

function stopAudioMonitor() {
  if (levelFrame) cancelAnimationFrame(levelFrame);
  levelFrame = 0;

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  audioContext = null;
  analyser = null;
  els.levelText.textContent = "0%";
  els.levelBars.forEach((bar) => {
    bar.style.setProperty("--level", "12%");
    bar.classList.remove("is-hot");
  });
}

async function copyTranscript() {
  const text = getTranscriptText();
  if (!text) {
    showToast("没有可复制的文本");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch {
    els.transcriptArea.select();
    document.execCommand("copy");
    showToast("已复制");
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadTxt() {
  const text = getTranscriptText();
  if (!text) {
    showToast("没有可导出的文本");
    return;
  }

  download(`voxnote-${new Date().toISOString().slice(0, 10)}.txt`, `${text}\n`, "text/plain");
}

function downloadSrt() {
  if (!segments.length) {
    showToast("没有可导出的分段");
    return;
  }

  const content = segments
    .map((segment, index) => {
      return [
        index + 1,
        `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}`,
        segment.text,
      ].join("\n");
    })
    .join("\n\n");

  download(`voxnote-${new Date().toISOString().slice(0, 10)}.srt`, `${content}\n`, "text/plain");
}

function downloadAudio() {
  if (!audioBlob) {
    showToast("还没有录音文件");
    return;
  }

  const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
  const url = URL.createObjectURL(audioBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `voxnote-audio-${new Date().toISOString().slice(0, 10)}.${extension}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function revokeAudioUrl() {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = "";
  }
  els.audioPlayback.removeAttribute("src");
  els.audioSection.hidden = true;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function bindEvents() {
  els.startButton.addEventListener("click", startRecording);
  els.stopButton.addEventListener("click", stopRecording);
  els.clearButton.addEventListener("click", clearAll);
  els.copyButton.addEventListener("click", copyTranscript);
  els.downloadTxtButton.addEventListener("click", downloadTxt);
  els.downloadSrtButton.addEventListener("click", downloadSrt);
  els.downloadAudioButton.addEventListener("click", downloadAudio);
  els.micCheckButton.addEventListener("click", () => {
    requestMicrophoneAccess().catch(() => {});
  });
  els.mediaFileInput.addEventListener("change", () => {
    const [file] = els.mediaFileInput.files || [];
    if (file) setSelectedFile(file);
  });
  els.fileDrop.addEventListener("dragenter", (event) => {
    event.preventDefault();
    els.fileDrop.classList.add("is-dragging");
  });
  els.fileDrop.addEventListener("dragover", (event) => event.preventDefault());
  els.fileDrop.addEventListener("dragleave", () => {
    els.fileDrop.classList.remove("is-dragging");
  });
  els.fileDrop.addEventListener("drop", handleFileDrop);
  els.transcribeFileButton.addEventListener("click", transcribeFile);
  els.startSystemButton.addEventListener("click", startSystemCapture);
  els.stopSystemButton.addEventListener("click", stopSystemCapture);
  els.transcribeSystemButton.addEventListener("click", transcribeSystemAudio);
  els.restoreButton.addEventListener("click", restoreDraft);
  els.formatButton.addEventListener("click", formatTranscript);
  els.timestampButton.addEventListener("click", insertTimestamp);
  els.themeButton.addEventListener("click", toggleTheme);
  els.openSettingsButton.addEventListener("click", openSettings);
  els.closeSettingsButton.addEventListener("click", closeSettings);
  els.settingsModal.addEventListener("click", (event) => {
    if (event.target === els.settingsModal) closeSettings();
  });
  els.saveApiKeyButton.addEventListener("click", saveApiKey);
  els.clearApiKeyButton.addEventListener("click", clearApiKey);
  els.refreshEngineButton.addEventListener("click", () => {
    updateEngineStatus();
    showToast("已刷新引擎状态");
  });
  els.settingsThemeButton.addEventListener("click", toggleTheme);
  els.toggleSegmentsButton.addEventListener("click", () => {
    setView(settings.view === "focus" ? "balanced" : "focus");
  });
  els.segmentSearch.addEventListener("input", renderSegments);
  els.segmentsList.addEventListener("click", handleSegmentAction);
  els.fontSizeRange.addEventListener("input", () => {
    setFontSize(els.fontSizeRange.value);
  });
  els.settingsFontSizeRange.addEventListener("input", () => {
    setFontSize(els.settingsFontSizeRange.value);
  });
  els.engineModel.addEventListener("change", () => {
    setCloudModel(els.engineModel.value);
  });
  els.settingsEngineModel.addEventListener("change", () => {
    setCloudModel(els.settingsEngineModel.value);
  });
  els.localModel.addEventListener("change", () => {
    setLocalModel(els.localModel.value);
  });
  els.settingsLocalModel.addEventListener("change", () => {
    setLocalModel(els.settingsLocalModel.value);
  });

  for (const button of els.viewButtons) {
    button.addEventListener("click", () => setView(button.dataset.viewMode));
  }

  for (const button of els.engineTypeButtons) {
    button.addEventListener("click", () => setEngine(button.dataset.engineType));
  }

  for (const button of els.settingsEngineButtons) {
    button.addEventListener("click", () => setEngine(button.dataset.settingsEngine));
  }

  els.transcriptArea.addEventListener("input", () => {
    updateMetrics();
    persistDraft();
  });
  els.continuousToggle.addEventListener("change", () => {
    shouldRestart = isListening && els.continuousToggle.checked;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.settingsModal.hidden) closeSettings();
  });
}

function boot() {
  bindEvents();
  settings = { ...settings, ...readSettings() };
  settings.density = "compact";
  applySettings();
  renderSegments();
  updateMetrics();
  updateEngineStatus();
  updateMicPermissionState();

  if (!SpeechRecognition) {
    els.startButton.disabled = true;
    setStatus("浏览器不支持", "idle");
    return;
  }

  setStatus("准备就绪", "ready");
}

window.addEventListener("beforeunload", () => {
  if (isListening) stopRecording();
  stopAudioMonitor();
  stopSystemTracks();
  revokeSelectedFileUrl();
  revokeSystemAudioUrl();
  revokeAudioUrl();
});

boot();

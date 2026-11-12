// soundEffects.ts
// Ultra-low-latency sound player using Web Audio API in-memory buffer with fallback

const SOUND_MP3_BASE64 = `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oaMKhMRmQKNDxs6jNLhQOJ/l9y2jDln//+WRcpmWq/TGRzP///oFYBtkv+IovRsFpNpFYSDoLs1eetiij46XvlObmqJlwZYTeiQV/rUqvdR/+Hf97VoIAAnRtK1W//uUZJWAAvM9Sds9GVAxgtntLMJjDI0lJ24kawC9i2kwB6AOtw+ucu2yocETco4TCxwBLgsHjdO9kk1mJJIn4e1TGS7xW1m691fadTbt5/zMt/Xb038vkf7/qLb3btlx5dvFpFaHMeZABHsvSg4b2mTyP//6RQAE7bG4i2B+rGB4yr4SMDgzPIED/G+O4QMa4cOLI7Uhp2GWX56iVhLABBiL03dExv36vb+oWSAAkLbkcacLYbIRAAAWDNAPZUZKYzIAhjAygE2Cm0MsGJFQUZcKnwe6cbogilB8PYnW2a58PWYIlcpOcM8pjcaRCVtVK8btSBAwDForqYuEzqerw3DzxBg5chAI2jxuFEX9azEpdAsuj9fsin4flLzrEpo1VpaWtQSmXwLbsTz8M0U3Ze66EhQCNRqrS2dVv////9+HHf+Lv47ksh/L/yxxq1v7/////59ww5//38q2ONXLKsCv8EAGHwQAYPhIGhKEj3//4IO//62wAHTNbZsJQ0wS//uUZLGAAsIxy2VswAA2gynNp4wAGUEpM7msgBIoFmV3NYAAAAAAH+EgSrAuVeFCSY62EORFSGjaYMdgWD0L1EWIw7LoUCqBxICZ1B96XtqnWyue/jvwDVTGQwoNf9WUVo7UlrZYDd9rGOWWXxmURClmL1XHLVJPY0usqarrdTLP8OfUx32udET1A1AqjgjE7LcYx3TRCQNFQke/3EVOLdH//64Al6ObqqqwCAiDAQEPBU6JQ1BqDVZ1eWkazvw78seyWWBr6jyj0S+/6Kj3//9sRTwJL0c3k0ijjEgrDiRLRKGlgq4seLHolgrLHlPkvq/Pa3YNHviKDW7iL90Rf//11Hi1TEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uURG4P8X8Gwh8MQAAwwOhj4wgAAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV`;

let audioCtx: AudioContext | null = null;
let soundBuffer: AudioBuffer | null = null;
let isBufferLoading = false;
let audioFallback: HTMLAudioElement | null = null;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/\s/g, "");
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function initSoundEffects(): void {
  if (typeof window === "undefined") return;

  // 1. Preload HTMLAudioElement fallback
  if (!audioFallback) {
    try {
      audioFallback = new Audio("/sound.mp3");
      audioFallback.preload = "auto";
    } catch {}
  }

  // 2. Pre-decode into Web Audio API memory buffer
  const ctx = getAudioContext();
  if (ctx && !soundBuffer && !isBufferLoading) {
    isBufferLoading = true;
    try {
      const buffer = base64ToArrayBuffer(SOUND_MP3_BASE64);
      ctx
        .decodeAudioData(buffer)
        .then((decoded) => {
          soundBuffer = decoded;
        })
        .catch(() => {
          // If inline decode fails, try network fetch from /sound.mp3
          fetch("/sound.mp3")
            .then((res) => res.arrayBuffer())
            .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
            .then((decoded) => {
              soundBuffer = decoded;
            })
            .catch((err) => {
              console.warn("[Sound] Buffer decoding fallback error:", err);
            });
        })
        .finally(() => {
          isBufferLoading = false;
        });
    } catch {
      isBufferLoading = false;
    }
  }
}

// Automatically unlock AudioContext on any user interaction
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    initSoundEffects();
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("gamepadconnected", unlockAudio, { passive: true });
}

export function playFocusShiftSound(): void {
  if (typeof window === "undefined") return;

  const ctx = getAudioContext();

  // Resume AudioContext if suspended
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  // 1. Primary path: Web Audio API (in-memory buffer, ~1-3ms latency, zero clipping, instantaneous)
  if (ctx && soundBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = soundBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.85;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn("[Sound] Web Audio playback error, using fallback:", err);
    }
  }

  // 2. Secondary fallback: HTMLAudioElement
  try {
    if (!audioFallback) {
      audioFallback = new Audio("/sound.mp3");
      audioFallback.preload = "auto";
    }
    audioFallback.currentTime = 0;
    audioFallback.play().catch(() => {});
  } catch {}
}

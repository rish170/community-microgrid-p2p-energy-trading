// soundEffects.ts
// Ultra-low-latency sound player using Web Audio API in-memory buffer with fallback

const SOUND1_BASE64 = `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oaMKhMRmQKNDxs6jNLhQOJ/l9y2jDln//+WRcpmWq/TGRzP///oFYBtkv+IovRsFpNpFYSDoLs1eetiij46XvlObmqJlwZYTeiQV/rUqvdR/+Hf97VoIAAnRtK1W//uUZJWAAvM9Sds9GVAxgtntLMJjDI0lJ24kawC9i2kwB6AOtw+ucu2yocETco4TCxwBLgsHjdO9kk1mJJIn4e1TGS7xW1m691fadTbt5/zMt/Xb038vkf7/qLb3btlx5dvFpFaHMeZABHsvSg4b2mTyP//6RQAE7bG4i2B+rGB4yr4SMDgzPIED/G+O4QMa4cOLI7Uhp2GWX56iVhLABBiL03dExv36vb+oWSAAkLbkcacLYbIRAAAWDNAPZUZKYzIAhjAygE2Cm0MsGJFQUZcKnwe6cbogilB8PYnW2a58PWYIlcpOcM8pjcaRCVtVK8btSBAwDForqYuEzqerw3DzxBg5chAI2jxuFEX9azEpdAsuj9fsin4flLzrEpo1VpaWtQSmXwLbsTz8M0U3Ze66EhQCNRqrS2dVv////9+HHf+Lv47ksh/L/yxxq1v7/////59ww5//38q2ONXLKsCv8EAGHwQAYPhIGhKEj3//4IO//62wAHTNbZsJQ0wS//uUZLGAAsIxy2VswAA2gynNp4wAGUEpM7msgBIoFmV3NYAAAAAAH+EgSrAuVeFCSY62EORFSGjaYMdgWD0L1EWIw7LoUCqBxICZ1B96XtqnWyue/jvwDVTGQwoNf9WUVo7UlrZYDd9rGOWWXxmURClmL1XHLVJPY0usqarrdTLP8OfUx32udET1A1AqjgjE7LcYx3TRCQNFQke/3EVOLdH//64Al6ObqqqwCAiDAQEPBU6JQ1BqDVZ1eWkazvw78seyWWBr6jyj0S+/6Kj3//9sRTwJL0c3k0ijjEgrDiRLRKGlgq4seLHolgrLHlPkvq/Pa3YNHviKDW7iL90Rf//11Hi1TEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uURG4P8X8Gwh8MQAAwwOhj4wgAAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV`;

const SOUND2_BASE64 = `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/////9CnVAowACAxdLRticCtMyZ7hmBcMgq3ttR5aqIBwbA08uHkcp73//uSZLSEAzgxTGNJHZA/AfoNBeopDABrMYy8bsD/iOq0BjQ+dd5aL3NVqBW1rQxfrO4xf93qxMm0DjwYFgATBgXSCB668Uch6EjkEoCS4VS/5FaNzF1h5a9r4o4PrqDPITByNaJ0uWDzBggqYGxtkBIlpZCh5JoqVB8uqFxwQTF+xWOhjAzL/69a3ZR4WcL1gRYu1J4uwq0sQF6yJndaWJOZ/////7PQFAgiaf3+V4rKZZDybwOmRueeiWVOkIxXPFYec718U9n/u1q65TvQHm8VbzvUKXfGU8zduyqdz5vSKDkBFAqDzhqD8axh2UUWr2tJnQmsaJBsTWVHq7hXSR/m/VHqV1gzwgQCqutsiaH9LrRJjGRFkyYI+lNFd/u0PQuye+cZarplJsQeIj2rIi8VQHDgSLVNJhwAgeKhti96OqjXQTc51OWpvs7KqcgESQQpUCDOLoHzfh33Yh13osm0CnUM5V2zJ76mJta5VsWAYzvH14f/JzEs8HxeFwcnbo08/C2mQkJBw6EnlXPPNDQjtgKxJ4Pc8VAMSNMfiz0oQ//7kmTQgAMzG0rZmGFwQIK5/wGNDwvYmykMrHSBF4joPGexDPe7LGlUD/lZHrA0QQGNZxS/RSG5LiZSEqGOmx+pgBOHggBJiCRdM6LEUkXAO7sbTwSPooEZtBzqM6lw1CiUdtVpMVb8SZR6RX/6TZf60IBB5gdEYarDDlZHaxhJPnWdT2uk6ffd9VwBb2fXLe6IIPCOBkOhLAyAoLRWPg/ElIjMUJ/83GHyNCq59JqQEROiMFidRIKgVOokFf8iEkciExiP4sPTtey0fqQwBNyQMiQCkQWa7ARGurRKSIoEgMKP1UHUxmifBjCSmeUppMYSckbjzFTlUbaLU8tT0agSdE5ZF0WfhUFgKWlSIaSFQkBfliLUkgoDICKliLT3aFRidDLQr49nKkh+2v2/48RE6kxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+5JE6YAi9CRJyFgx0F1muRg8w3gJ9G0MJgR0QVsOYYBnmRiqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq`;

const SOUND3_BASE64 = `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QOAgsLnP/2/qFhVD1f/lda5sM/rOx4Kgqcy/FP1ozCP0uxAjzFmDCH8OUJChBOi2uoTM3FuE2LE2iKoASHI6aprRqXyt5xK4pgYc5E6d/36P1f/6Ef//+u//9YiPCIGlMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uSRPOABJFUzmsMMtppYol5YSNaSSxhBiSwRcEbjeAA9JpAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAEABpQcjUrkpwag2B0QBuTQKtHllnywyakwZysMv7LDWGxr/soNDlQ1aOTX/5YZfc1apy1DXNWtlhrLIatcyn9h+Vz+5/rKWTQ1hrDW/8NWh+X9y7DJgoNAKROntVcACNZCaKjVBRCIQ8KwiGiFJNSD8KyopSWMpruJaf9LL4Is+1Xkktliu/+/5V0w1e31ZFWx8xWq6WUn3f/7for40qopf///0tNSyxWi/pSsRZUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7kmSYD/LxX7aozBkwUGFXFgTJEkAAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=`;

let audioCtx: AudioContext | null = null;
let shiftBuffer: AudioBuffer | null = null;
let selectBuffer: AudioBuffer | null = null;
let backBuffer: AudioBuffer | null = null;
let isBufferLoading = false;
let shiftFallback: HTMLAudioElement | null = null;
let selectFallback: HTMLAudioElement | null = null;
let backFallback: HTMLAudioElement | null = null;

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

  // 1. Preload HTMLAudioElement fallbacks
  if (!shiftFallback) {
    try {
      shiftFallback = new Audio("/sound.mp3");
      shiftFallback.preload = "auto";
    } catch {}
  }
  if (!selectFallback) {
    try {
      selectFallback = new Audio("/sound2.mp3");
      selectFallback.preload = "auto";
    } catch {}
  }
  if (!backFallback) {
    try {
      backFallback = new Audio("/sound3.mp3");
      backFallback.preload = "auto";
    } catch {}
  }

  // 2. Pre-decode into Web Audio API memory buffers for true 0ms latency
  const ctx = getAudioContext();
  if (ctx && !isBufferLoading) {
    isBufferLoading = true;

    // Decode Sound 1 (Focus Shift)
    if (!shiftBuffer) {
      try {
        const buf1 = base64ToArrayBuffer(SOUND1_BASE64);
        ctx
          .decodeAudioData(buf1)
          .then((decoded) => {
            shiftBuffer = decoded;
          })
          .catch(() => {
            fetch("/sound.mp3")
              .then((res) => res.arrayBuffer())
              .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
              .then((decoded) => {
                shiftBuffer = decoded;
              })
              .catch((err) => console.warn("[Sound1] Fetch error:", err));
          });
      } catch {}
    }

    // Decode Sound 2 (House Selection)
    if (!selectBuffer) {
      try {
        const buf2 = base64ToArrayBuffer(SOUND2_BASE64);
        ctx
          .decodeAudioData(buf2)
          .then((decoded) => {
            selectBuffer = decoded;
          })
          .catch(() => {
            fetch("/sound2.mp3")
              .then((res) => res.arrayBuffer())
              .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
              .then((decoded) => {
                selectBuffer = decoded;
              })
              .catch((err) => console.warn("[Sound2] Fetch error:", err));
          });
      } catch {}
    }

    // Decode Sound 3 (Go Back / Deselect)
    if (!backBuffer) {
      try {
        const buf3 = base64ToArrayBuffer(SOUND3_BASE64);
        ctx
          .decodeAudioData(buf3)
          .then((decoded) => {
            backBuffer = decoded;
          })
          .catch(() => {
            fetch("/sound3.mp3")
              .then((res) => res.arrayBuffer())
              .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
              .then((decoded) => {
                backBuffer = decoded;
              })
              .catch((err) => console.warn("[Sound3] Fetch error:", err));
          });
      } catch {}
    }

    isBufferLoading = false;
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
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  // Web Audio API buffer playback (~1-3ms in-memory, zero stutter)
  if (ctx && shiftBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = shiftBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.85;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn("[Sound1] Play error, falling back:", err);
    }
  }

  // Fallback: HTMLAudioElement
  try {
    if (!shiftFallback) {
      shiftFallback = new Audio("/sound.mp3");
      shiftFallback.preload = "auto";
    }
    shiftFallback.currentTime = 0;
    shiftFallback.play().catch(() => {});
  } catch {}
}

export function playSelectSound(): void {
  if (typeof window === "undefined") return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  // Web Audio API buffer playback (~1-3ms in-memory)
  if (ctx && selectBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = selectBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.9;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn("[Sound2] Play error, falling back:", err);
    }
  }

  // Fallback: HTMLAudioElement
  try {
    if (!selectFallback) {
      selectFallback = new Audio("/sound2.mp3");
      selectFallback.preload = "auto";
    }
    selectFallback.currentTime = 0;
    selectFallback.play().catch(() => {});
  } catch {}
}

export function playBackSound(): void {
  if (typeof window === "undefined") return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  // Web Audio API buffer playback (~1-3ms in-memory)
  if (ctx && backBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = backBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.9;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn("[Sound3] Play error, falling back:", err);
    }
  }

  // Fallback: HTMLAudioElement
  try {
    if (!backFallback) {
      backFallback = new Audio("/sound3.mp3");
      backFallback.preload = "auto";
    }
    backFallback.currentTime = 0;
    backFallback.play().catch(() => {});
  } catch {}
}

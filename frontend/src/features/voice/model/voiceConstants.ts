export const VOICE_BUBBLE_TIMEOUT_MS = 2800;
export const VOICE_DUPLICATE_WINDOW_MS = 1400;

// The recorder stops by VAD silence. These values are safety caps only.
// Wake can stay moderate; command must be long enough for natural speech.
export const VOICE_WAKE_SESSION_MS = 12_000;
export const VOICE_COMMAND_SESSION_MS = 22_000;

export const VOICE_AUTO_LISTENER_RESTART_MS = 650;
export const VOICE_COMMAND_CAPTURE_TIMEOUT_MS = 28_000;

// Wake miss cooldown must be finite and self-releasing.
// It protects STT cost from random speech, but must not feel like the assistant froze.
export const VOICE_WAKE_MISS_BASE_COOLDOWN_MS = 1_800;
export const VOICE_WAKE_MISS_MAX_COOLDOWN_MS = 6_000;

export const VOICE_AFTER_DISPATCH_COOLDOWN_MS = 1400;
export const VOICE_MIN_COMMAND_TEXT_LENGTH = 3;

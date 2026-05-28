export const VOICE_BUBBLE_TIMEOUT_MS = 2800;
export const VOICE_DUPLICATE_WINDOW_MS = 60_000;

// Manual press-to-talk caps. There is no background cyclic STT anymore.
export const VOICE_MANUAL_SESSION_MS = 15_000;
export const VOICE_AFTER_DISPATCH_COOLDOWN_MS = 700;
export const VOICE_MIN_COMMAND_TEXT_LENGTH = 3;

// Kept as compatibility exports for old imports in tests or cached branches.
export const VOICE_WAKE_SESSION_MS = VOICE_MANUAL_SESSION_MS;
export const VOICE_COMMAND_SESSION_MS = VOICE_MANUAL_SESSION_MS;
export const VOICE_COMMAND_CAPTURE_TIMEOUT_MS = VOICE_MANUAL_SESSION_MS;
export const VOICE_AUTO_LISTENER_RESTART_MS = 0;
export const VOICE_WAKE_MISS_BASE_COOLDOWN_MS = 0;
export const VOICE_WAKE_MISS_MAX_COOLDOWN_MS = 0;

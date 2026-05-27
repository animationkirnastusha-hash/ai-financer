export const VOICE_BUBBLE_TIMEOUT_MS = 2800;
export const VOICE_DUPLICATE_WINDOW_MS = 1400;

// The recorder stops by VAD silence. These values are only safety caps.
// They must be longer than a normal phrase so speech is not cut in the middle.
export const VOICE_WAKE_SESSION_MS = 12_000;
export const VOICE_COMMAND_SESSION_MS = 22_000;

export const VOICE_AUTO_LISTENER_RESTART_MS = 650;
export const VOICE_COMMAND_CAPTURE_TIMEOUT_MS = 28_000;
export const VOICE_WAKE_MISS_BASE_COOLDOWN_MS = 2_800;
export const VOICE_WAKE_MISS_MAX_COOLDOWN_MS = 15_000;
export const VOICE_AFTER_DISPATCH_COOLDOWN_MS = 1400;
export const VOICE_MIN_COMMAND_TEXT_LENGTH = 3;

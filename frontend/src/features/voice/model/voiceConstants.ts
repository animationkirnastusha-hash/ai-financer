export const VOICE_BUBBLE_TIMEOUT_MS = 2800;
export const VOICE_DUPLICATE_WINDOW_MS = 60_000;

// The recorder stops by VAD silence. These values are only safety caps.
// They must be longer than a normal phrase so speech is not cut in the middle.
export const VOICE_WAKE_SESSION_MS = 10_000;
export const VOICE_COMMAND_SESSION_MS = 10_000;

export const VOICE_AUTO_LISTENER_RESTART_MS = 1800;
export const VOICE_COMMAND_CAPTURE_TIMEOUT_MS = 12_000;
export const VOICE_AFTER_DISPATCH_COOLDOWN_MS = 6500;
export const VOICE_MIN_COMMAND_TEXT_LENGTH = 3;

// Wake-miss cooldown is visual/lifecycle only. It prevents a tight STT loop
// after a phrase that does not contain the assistant name.
export const VOICE_WAKE_MISS_BASE_COOLDOWN_MS = 1800;
export const VOICE_WAKE_MISS_MAX_COOLDOWN_MS = 6000;

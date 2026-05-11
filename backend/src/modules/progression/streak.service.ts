function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(left: Date, right: Date) {
  const a = startOfLocalDay(left).getTime();
  const b = startOfLocalDay(right).getTime();
  return Math.round((a - b) / 86_400_000);
}

export class StreakService {
  getNextStreak(currentStreak: number, lastActiveAt: Date | null | undefined, now = new Date()) {
    if (!lastActiveAt) return 1;

    const diff = daysBetween(now, lastActiveAt);

    if (diff <= 0) return Math.max(1, currentStreak);
    if (diff === 1) return Math.max(1, currentStreak) + 1;
    return 1;
  }

  isNewActiveDay(lastActiveAt: Date | null | undefined, now = new Date()) {
    if (!lastActiveAt) return true;
    return daysBetween(now, lastActiveAt) > 0;
  }
}

export const streakService = new StreakService();

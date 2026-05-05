export class AIValidationService {
  validateAmount(amount: number) {
    if (!amount || isNaN(amount)) return false;
    if (amount <= 0) return false;
    if (amount > 1_000_000) return false;
    return true;
  }
}
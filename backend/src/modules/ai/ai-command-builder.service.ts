import { AIHandleOptions } from './types';

export class AICommandBuilderService {
  build(command: string, _options: AIHandleOptions = {}) {
    return command;
  }
}

import { describe, it, expect } from 'vitest';
import { createBot } from '../src/bot.js';

describe('Bot Creation', () => {
  it('instantiates grammY bot without throwing', () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe('function');
    expect(typeof bot.on).toBe('function');
  });
});

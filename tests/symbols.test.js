import { describe, it, expect } from 'vitest';
import { toLogicSymbols } from '../src/core/symbols.js';

describe('live symbol conversion', () => {
  it('turns ASCII into logic symbols', () => {
    expect(toLogicSymbols('(A -> B) & (A -> C) -> (A -> B /\\ C)')).toBe('(A ⇒ B) ∧ (A ⇒ C) ⇒ (A ⇒ B ∧ C)');
    expect(toLogicSymbols('~A \\/ B | C')).toBe('¬A ∨ B ∨ C');
    expect(toLogicSymbols('A, B |- _|_')).toBe('A, B ⊢ ⊥');
  });
  it('waits for the second character of a two-char operator', () => {
    expect(toLogicSymbols('A -')).toBe('A -');
    expect(toLogicSymbols('A |')).toBe('A |');
    expect(toLogicSymbols('_|')).toBe('_|');
  });
});

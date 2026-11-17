import { describe, it, expect } from 'vitest';
import { parseFormula as p } from '../src/parser/parse.js';
import { show } from '../src/core/formula.js';
import { suggestFormulas } from '../src/core/suggest.js';

const names = list => list.map(f => show(f));

describe('formula suggestions', () => {
  const ctx = [p('(A -> B) & (A -> C)'), p('A')];

  it('⇒E suggests antecedents of implications that end in the goal', () => {
    expect(names(suggestFormulas('ImpE', p('B'), ctx).best)).toEqual(['A']);
  });
  it('∧E₁ suggests the right part of a conjunction starting with the goal', () => {
    expect(names(suggestFormulas('AndE1', p('A -> B'), ctx).best)).toEqual(['A ⇒ C']);
  });
  it('∧E₂ suggests the left part of a conjunction ending with the goal', () => {
    expect(names(suggestFormulas('AndE2', p('A -> C'), ctx).best)).toEqual(['A ⇒ B']);
  });
  it('∨E suggests disjunctions from the hypotheses', () => {
    expect(names(suggestFormulas('OrE', p('B | A'), [p('A | B')]).best)).toEqual(['A ∨ B']);
  });
  it('¬E suggests what is negated in the hypotheses', () => {
    expect(names(suggestFormulas('NotE', p('_|_'), [p('A'), p('~A')]).best)).toEqual(['A']);
  });
  it('never repeats a best suggestion among the others', () => {
    const { best, other } = suggestFormulas('ImpE', p('B'), ctx);
    expect(other.some(f => best.some(b => show(b) === show(f)))).toBe(false);
  });
});

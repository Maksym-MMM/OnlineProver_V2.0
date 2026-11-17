import { describe, it, expect } from 'vitest';
import { parseFormula, parseSequent } from '../src/parser/parse.js';
import { show, equal } from '../src/core/formula.js';
import { resolveRule } from '../src/core/rules.js';
import { newNode as N, validate, applyRule } from '../src/core/proof.js';

const run = (root, opts = {}) => validate(root, { assumptions: [], classical: true, ...opts });

describe('parser', () => {
  it('reads OnlineProver ASCII notation', () => {
    expect(show(parseFormula('((A -> B) /\\ (A -> C)) -> (A -> B /\\ C)')))
      .toBe('(A ⇒ B) ∧ (A ⇒ C) ⇒ (A ⇒ B ∧ C)');
    expect(show(parseFormula('~(A \\/ B)'))).toBe('¬(A ∨ B)');
    expect(show(parseFormula('_|_'))).toBe('⊥');
  });
  it('round-trips through show', () => {
    for (const s of ['(A ⇒ B) ⇒ C', 'A ⇒ B ⇒ C', 'A ∧ (B ∧ C)', '¬¬A', '(A ∨ B) ∧ C']) {
      const f = parseFormula(s);
      expect(equal(parseFormula(show(f)), f)).toBe(true);
      expect(equal(parseFormula(show(f, 'ascii')), f)).toBe(true);
    }
  });
  it('parses sequents', () => {
    const q = parseSequent('A, A -> B |- B');
    expect(q.assumptions.length).toBe(2);
    expect(show(q.goal)).toBe('B');
  });
  it('rejects garbage', () => {
    expect(() => parseFormula('A -> ')).toThrow();
  });
});

describe('rule names', () => {
  it('accepts ASCII and Unicode spellings', () => {
    expect(resolveRule('->I')).toBe('ImpI');
    expect(resolveRule('⇒E')).toBe('ImpE');
    expect(resolveRule('/\\E1')).toBe('AndE1');
    expect(resolveRule('\\/E')).toBe('OrE');
    expect(resolveRule('⊥E₂')).toBe('RAA');
    expect(resolveRule('foo')).toBe(null);
  });
});

describe('checking', () => {
  it('accepts the full proof of Example 1', () => {
    const root = N('((A -> B) /\\ (A -> C)) -> (A -> B /\\ C)', '->I', [
      N('A -> B /\\ C', '->I', [
        N('B /\\ C', '/\\I', [
          N('B', '->E', [N('A'), N('A -> B', '/\\E1', [N('(A -> B) /\\ (A -> C)')])]),
          N('C', '->E', [N('A'), N('A -> C', '/\\E2', [N('(A -> B) /\\ (A -> C)')])]),
        ]),
      ]),
    ]);
    const r = run(root);
    expect([...r.byId.values()].filter(i => i.status !== 'ok').map(i => i.message)).toEqual([]);
    expect(r.solved).toBe(true);
  });

  it('flags a wrong premise and an undischarged leaf', () => {
    const root = N('A -> B', '->I', [N('A')]);
    const r = run(root);
    expect(r.byId.get(root.id).status).toBe('error');
    expect(r.solved).toBe(false);
  });

  it('marks open goals and warns about dead ends', () => {
    const leaf = N('A');
    const root = N('A \\/ B -> A', '->I', [leaf]);
    const r = run(root);
    expect(r.byId.get(leaf.id).status).toBe('open');
    expect(r.byId.get(leaf.id).warning).toMatch(/Dead end/);
  });

  it('can require an explicit Ax on assumption leaves', () => {
    const leaf = N('A');
    const root = N('A -> A', '->I', [leaf]);
    expect(run(root).solved).toBe(true);
    expect(run(root, { implicitAx: false }).solved).toBe(false);
    leaf.rule = 'Ax';
    expect(run(root, { implicitAx: false }).solved).toBe(true);
  });

  it('forbids ⊥E₂ in intuitionistic logic', () => {
    const root = N('A', 'RAA', [N('_|_')]);
    expect(run(root, { classical: false }).byId.get(root.id).status).toBe('error');
  });

  it('uses assumptions from a sequent', () => {
    const { assumptions, goal } = parseSequent('A, A -> B |- B');
    const root = N(show(goal), '->E', [N('A'), N('A -> B')]);
    expect(run(root, { assumptions }).solved).toBe(true);
  });

  it('discharges ∨E assumptions per branch', () => {
    const root = N('A \\/ B -> B \\/ A', '->I', [
      N('B \\/ A', '\\/E', [N('A \\/ B'), N('B \\/ A', '\\/I2', [N('A')]), N('B \\/ A', '\\/I1', [N('B')])]),
    ]);
    expect(run(root).solved).toBe(true);
  });
});

describe('applyRule', () => {
  it('generates premises like LogicProof rule buttons', () => {
    const n = N('A -> B /\\ C');
    applyRule(n, 'ImpI');
    expect(n.premises.map(p => p.text)).toEqual(['B ∧ C']);
    const m = N('B');
    applyRule(m, 'ImpE', parseFormula('A'));
    expect(m.premises.map(p => p.text)).toEqual(['A', 'A ⇒ B']);
  });
});

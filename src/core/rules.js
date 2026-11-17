// Natural deduction rules (Gentzen, sequent notation Γ ⊢ φ).
// The rule set and semantics are ported from LogicProof
// (js/proofs/gentzen/rulesGentzen.js, ruleGentzenHandlers.js, MIT),
// rewritten as pure functions without DOM: a rule receives the conclusion,
// the premises and the context and returns a verdict.
import { F, equal, member, show } from './formula.js';

/**
 * Each rule:
 *  arity           - number of premises
 *  classicalOnly   - classical logic only
 *  applies(φ)      - can it be applied to goal φ (like `condition` in LogicProof)
 *  needs           - which formula the student must provide to generate premises
 *  premises(φ, x)  - premises the rule creates: [{ f }]
 *  check(φ, ps, Γ) - returns null (ok) or an error message; ps are premise formulas
 *  discharge(φ, ps)- formulas added to the context of each premise
 */
const s = f => show(f);
const need = (cond, msg) => (cond ? null : msg);

export const RULES = {
  Ax: {
    label: 'Ax', arity: 0,
    applies: () => true,
    check: (φ, _ps, Γ) => need(member(φ, Γ), `${s(φ)} is not among the assumptions`),
  },
  TopI: {
    label: '⊤I', arity: 0,
    applies: φ => φ.t === 'top',
    check: φ => need(φ.t === 'top', '⊤I only proves ⊤'),
  },
  BotE: {
    label: '⊥E', arity: 1,
    applies: () => true,
    premises: () => [{ f: F.bot() }],
    check: (_φ, [p]) => need(p.t === 'bot', 'The premise of ⊥E must be ⊥'),
  },
  RAA: {
    label: '⊥E₂', arity: 1, classicalOnly: true,
    applies: () => true,
    premises: φ => [{ f: F.bot() }],
    discharge: φ => [[F.not(φ)]],
    check: (_φ, [p]) => need(p.t === 'bot', 'The premise of ⊥E₂ must be ⊥ (assuming ¬φ)'),
  },
  NotI: {
    label: '¬I', arity: 1,
    applies: φ => φ.t === 'not',
    premises: () => [{ f: F.bot() }],
    discharge: φ => (φ.t === 'not' ? [[φ.a]] : [[]]),
    check: (φ, [p]) =>
      need(φ.t === 'not', '¬I only proves a negation ¬ψ') ??
      need(p.t === 'bot', 'The premise of ¬I must be ⊥'),
  },
  NotE: {
    label: '¬E', arity: 2, needs: 'ψ',
    applies: φ => φ.t === 'bot',
    premises: (_φ, ψ) => [{ f: ψ }, { f: F.not(ψ) }],
    check: (φ, [p, q]) =>
      need(φ.t === 'bot', '¬E only proves ⊥') ??
      need(equal(q, F.not(p)) || equal(p, F.not(q)), 'The premises of ¬E must be ψ and ¬ψ'),
  },
  AndI: {
    label: '∧I', arity: 2,
    applies: φ => φ.t === 'and',
    premises: φ => [{ f: φ.a }, { f: φ.b }],
    check: (φ, [p, q]) =>
      need(φ.t === 'and', '∧I only proves a conjunction') ??
      need(equal(p, φ.a) && equal(q, φ.b), `The premises of ∧I must be ${s(φ.a)} and ${s(φ.b)}`),
  },
  AndE1: {
    label: '∧E₁', arity: 1, needs: 'ψ',
    applies: () => true,
    premises: (φ, ψ) => [{ f: F.and(φ, ψ) }],
    check: (φ, [p]) => need(p.t === 'and' && equal(p.a, φ), `The premise of ∧E₁ must be ${s(φ)} ∧ ψ`),
  },
  AndE2: {
    label: '∧E₂', arity: 1, needs: 'ψ',
    applies: () => true,
    premises: (φ, ψ) => [{ f: F.and(ψ, φ) }],
    check: (φ, [p]) => need(p.t === 'and' && equal(p.b, φ), `The premise of ∧E₂ must be ψ ∧ ${s(φ)}`),
  },
  OrI1: {
    label: '∨I₁', arity: 1,
    applies: φ => φ.t === 'or',
    premises: φ => [{ f: φ.a }],
    check: (φ, [p]) =>
      need(φ.t === 'or', '∨I only proves a disjunction') ?? need(equal(p, φ.a), `The premise of ∨I₁ must be ${s(φ.a)}`),
  },
  OrI2: {
    label: '∨I₂', arity: 1,
    applies: φ => φ.t === 'or',
    premises: φ => [{ f: φ.b }],
    check: (φ, [p]) =>
      need(φ.t === 'or', '∨I only proves a disjunction') ?? need(equal(p, φ.b), `The premise of ∨I₂ must be ${s(φ.b)}`),
  },
  OrE: {
    label: '∨E', arity: 3, needs: 'ψ ∨ χ',
    applies: () => true,
    premises: (φ, d) => [{ f: d }, { f: φ }, { f: φ }],
    discharge: (_φ, [d]) => (d && d.t === 'or' ? [[], [d.a], [d.b]] : [[], [], []]),
    check: (φ, [d, p, q]) =>
      need(d.t === 'or', 'The first premise of ∨E must be a disjunction') ??
      need(equal(p, φ) && equal(q, φ), `The second and third premises of ∨E must be ${s(φ)}`),
  },
  ImpI: {
    label: '⇒I', arity: 1,
    applies: φ => φ.t === 'imp',
    premises: φ => [{ f: φ.b }],
    discharge: φ => (φ.t === 'imp' ? [[φ.a]] : [[]]),
    check: (φ, [p]) =>
      need(φ.t === 'imp', '⇒I only proves an implication') ?? need(equal(p, φ.b), `The premise of ⇒I must be ${s(φ.b)}`),
  },
  ImpE: {
    label: '⇒E', arity: 2, needs: 'ψ',
    applies: () => true,
    premises: (φ, ψ) => [{ f: ψ }, { f: F.imp(ψ, φ) }],
    check: (φ, [p, q]) =>
      need((q.t === 'imp' && equal(q.a, p) && equal(q.b, φ)) || (p.t === 'imp' && equal(p.a, q) && equal(p.b, φ)),
        `The premises of ⇒E must be ψ and ψ ⇒ ${s(φ)}`),
  },
};

// Accepted spellings of rule names (ASCII and Unicode).
const ALIASES = {
  Ax: ['ax', 'hyp', 'h', 'id', 'assumption'],
  TopI: ['⊤i', 'topi', 'ti', 'truei'],
  BotE: ['⊥e', '⊥e1', '_|_e', 'bote', 'bote1', 'fe', 'efq'],
  RAA: ['⊥e2', '_|_e2', 'bote2', 'raa', 'pbc', 'fe2'],
  NotI: ['¬i', '~i', '!i', 'noti', 'negi'],
  NotE: ['¬e', '~e', '!e', 'note', 'nege'],
  AndI: ['∧i', '/\\i', '&i', 'andi', 'ci'],
  AndE1: ['∧e1', '/\\e1', '&e1', 'ande1', '∧el', '/\\el', 'andel'],
  AndE2: ['∧e2', '/\\e2', '&e2', 'ande2', '∧er', '/\\er', 'ander'],
  OrI1: ['∨i1', '\\/i1', '|i1', 'ori1', '∨il', '\\/il', 'oril'],
  OrI2: ['∨i2', '\\/i2', '|i2', 'ori2', '∨ir', '\\/ir', 'orir'],
  OrE: ['∨e', '\\/e', '|e', 'ore'],
  ImpI: ['⇒i', '->i', '=>i', '→i', 'impi', 'ii'],
  ImpE: ['⇒e', '->e', '=>e', '→e', 'impe', 'ie', 'mp'],
};
const LOOKUP = new Map();
for (const [id, names] of Object.entries(ALIASES)) {
  LOOKUP.set(id.toLowerCase(), id);
  LOOKUP.set(RULES[id].label.toLowerCase(), id);
  names.forEach(n => LOOKUP.set(n, id));
}

/** Rule name as typed -> rule id, or null. */
export function resolveRule(text) {
  const key = (text || '').replace(/\s+/g, '').replace(/[()]/g, '').toLowerCase();
  if (!key) return null;
  return LOOKUP.get(key) ?? null;
}

/** Rules applicable to goal φ (like LogicProof's button filter). */
export function applicableRules(φ, { classical = true, allowed = null } = {}) {
  return Object.entries(RULES)
    .filter(([id, r]) => (classical || !r.classicalOnly) && (!allowed || allowed.includes(id)))
    .filter(([, r]) => !φ || r.applies(φ))
    .map(([id]) => id);
}

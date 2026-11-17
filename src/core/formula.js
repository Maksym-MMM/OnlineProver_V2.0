// Canonical propositional formulas.
// Strict comparison (compareExpressionsStrict) and minimal-parentheses printing follow
// LogicProof (js/core/deductiveEngine.js, js/core/formatter.js, MIT).

export const F = {
  atom: name => ({ t: 'atom', name }),
  bot: () => ({ t: 'bot' }),
  top: () => ({ t: 'top' }),
  not: a => ({ t: 'not', a }),
  and: (a, b) => ({ t: 'and', a, b }),
  or: (a, b) => ({ t: 'or', a, b }),
  imp: (a, b) => ({ t: 'imp', a, b }),
};

export const isBinary = f => f.t === 'and' || f.t === 'or' || f.t === 'imp';

/** Exact structural equality (no commutativity - rules must match exactly). */
export function equal(x, y) {
  if (x === y) return true;
  if (!x || !y || x.t !== y.t) return false;
  switch (x.t) {
    case 'atom': return x.name === y.name;
    case 'bot': case 'top': return true;
    case 'not': return equal(x.a, y.a);
    default: return equal(x.a, y.a) && equal(x.b, y.b);
  }
}

export const member = (f, list) => list.some(g => equal(f, g));

const SYMBOLS = {
  unicode: { not: '¬', and: ' ∧ ', or: ' ∨ ', imp: ' ⇒ ', bot: '⊥', top: '⊤' },
  ascii: { not: '~', and: ' /\\ ', or: ' \\/ ', imp: ' -> ', bot: '_|_', top: '⊤' },
};
const PREC = { imp: 1, or: 2, and: 3, not: 4, atom: 5, bot: 5, top: 5 };

/**
 * Printing with minimal parentheses: ⇒ is right-associative, ∧ and ∨ left-associative
 * (as the LogicProof grammar parses them).
 */
export function show(f, notation = 'unicode') {
  const s = SYMBOLS[notation] || SYMBOLS.unicode;
  const go = (f, ctx) => {
    let out;
    switch (f.t) {
      case 'atom': return f.name;
      case 'bot': return s.bot;
      case 'top': return s.top;
      case 'not': return s.not + go(f.a, 'not');
      default: {
        const p = PREC[f.t];
        const leftNeeds = PREC[f.a.t] < p || (f.t === 'imp' && f.a.t === 'imp');
        const rightNeeds = PREC[f.b.t] < p || f.b.t === f.t;
        const l = leftNeeds ? `(${go(f.a, f.t)})` : go(f.a, f.t);
        const r = rightNeeds ? `(${go(f.b, f.t)})` : go(f.b, f.t);
        out = l + s[f.t] + r;
        return ctx === 'not' ? `(${out})` : out;
      }
    }
  };
  return go(f, null);
}

/** Atoms of a formula (for truth tables). */
export function atoms(f, acc = new Set()) {
  if (f.t === 'atom') acc.add(f.name);
  if (f.a) atoms(f.a, acc);
  if (f.b) atoms(f.b, acc);
  return acc;
}

export function evaluate(f, v) {
  switch (f.t) {
    case 'atom': return !!v[f.name];
    case 'bot': return false;
    case 'top': return true;
    case 'not': return !evaluate(f.a, v);
    case 'and': return evaluate(f.a, v) && evaluate(f.b, v);
    case 'or': return evaluate(f.a, v) || evaluate(f.b, v);
    case 'imp': return !evaluate(f.a, v) || evaluate(f.b, v);
  }
}

/**
 * Classical counterexample to Γ ⊢ φ: a valuation where all of Γ is true and φ is false,
 * or null if the sequent is classically valid.
 */
export function counterexample(context, goal) {
  const names = [...[...context, goal].reduce((s, f) => atoms(f, s), new Set())].sort();
  if (names.length > 16) return null;
  for (let m = 0; m < 1 << names.length; m++) {
    const v = {};
    names.forEach((n, i) => { v[n] = !!(m & (1 << i)); });
    if (context.every(g => evaluate(g, v)) && !evaluate(goal, v)) return v;
  }
  return null;
}

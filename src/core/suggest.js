// Suggested formulas for rules that ask the user for one (⇒E, ∧E₁, ∧E₂, ∨E, ¬E).
// Candidates come from the hypotheses Γ of the goal and from the goal itself.
import { equal } from './formula.js';

/** All subformulas of f (including f), outermost first. */
export function subformulas(f, acc = []) {
  acc.push(f);
  if (f.a) subformulas(f.a, acc);
  if (f.b) subformulas(f.b, acc);
  return acc;
}

function uniq(list) {
  const out = [];
  for (const f of list) if (!out.some(g => equal(f, g))) out.push(f);
  return out;
}

/**
 * Returns { best, other }:
 *  best  - formulas that make the step close against a hypothesis (or are very likely)
 *  other - further candidates built from subformulas of Γ and the goal
 */
export function suggestFormulas(ruleId, goal, context, limit = 10) {
  const pool = uniq(context.flatMap(h => subformulas(h)));
  const fromGoal = subformulas(goal);
  let best = [];
  let other = [];

  switch (ruleId) {
    case 'ImpE':
      best = pool.filter(f => f.t === 'imp' && equal(f.b, goal)).map(f => f.a);
      other = pool.filter(f => f.t !== 'bot' && f.t !== 'top');
      break;
    case 'AndE1':
      best = pool.filter(f => f.t === 'and' && equal(f.a, goal)).map(f => f.b);
      other = pool;
      break;
    case 'AndE2':
      best = pool.filter(f => f.t === 'and' && equal(f.b, goal)).map(f => f.a);
      other = pool;
      break;
    case 'OrE':
      best = pool.filter(f => f.t === 'or');
      other = fromGoal.filter(f => f.t === 'or');
      break;
    case 'NotE':
      best = pool.filter(f => f.t === 'not').map(f => f.a);
      other = [...context.map(h => (h.t === 'not' ? h.a : h)), ...pool];
      break;
    default:
      other = pool;
  }
  best = uniq(best);
  other = uniq(other).filter(f => !best.some(b => equal(b, f)));
  return { best: best.slice(0, limit), other: other.slice(0, Math.max(0, limit - best.length)) };
}

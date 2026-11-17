// Proof tree model and per-step checking.
// A node is a conclusion (formula text), a rule name and the premises above the bar.
// Contexts (assumptions) are computed from the root upwards:
// ⇒I, ¬I, ⊥E₂ and ∨E add their assumptions.
import { parseFormula, ParseError } from '../parser/parse.js';
import { member, counterexample } from './formula.js';
import { RULES, resolveRule } from './rules.js';
import { show } from './formula.js';

let nextId = 1;
export const newNode = (text = '', rule = '', premises = []) => ({ id: nextId++, text, rule, premises });

export function serialize(n) {
  return { text: n.text, rule: n.rule, premises: n.premises.map(serialize) };
}
export function deserialize(o) {
  return newNode(o.text ?? '', o.rule ?? '', (o.premises || []).map(deserialize));
}

export function findNode(root, id, parent = null) {
  if (root.id === id) return { node: root, parent };
  for (const p of root.premises) {
    const r = findNode(p, id, root);
    if (r) return r;
  }
  return null;
}

function tryParse(text) {
  try {
    return { f: parseFormula(text) };
  } catch (e) {
    return { error: e instanceof ParseError ? e.message : 'Could not parse the formula' };
  }
}

/**
 * Validates the whole tree.
 * settings: { assumptions, classical, allowed, implicitAx }
 *   implicitAx: true  - a leaf that is an assumption is closed automatically
 *               false - it needs an explicit Ax (LogicProof behaviour)
 * Returns { byId: Map<id, Info>, solved, counts }.
 * Info: { status: 'ok'|'open'|'error'|'incomplete'|'empty', message, formula,
 *         context, ruleId, implicitAx, warning, counterexample }
 */
export function validate(root, settings) {
  const byId = new Map();
  const { classical = true, allowed = null } = settings;

  const visit = (node, context) => {
    const info = { context, status: 'ok', message: null, warning: null, formula: null, ruleId: null };
    byId.set(node.id, info);

    const parsed = node.text.trim() ? tryParse(node.text) : { empty: true };
    if (parsed.f) info.formula = parsed.f;

    const ruleId = resolveRule(node.rule);
    info.ruleId = ruleId;
    const premiseFormulas = node.premises.map(p => (p.text.trim() ? tryParse(p.text).f ?? null : null));
    let extra = node.premises.map(() => []);
    const rule = ruleId && RULES[ruleId];
    if (rule?.discharge && parsed.f) {
      const d = rule.discharge(parsed.f, premiseFormulas);
      extra = node.premises.map((_, i) => d[i] || []);
    }
    node.premises.forEach((p, i) => visit(p, [...context, ...extra[i].filter(f => !member(f, context))]));

    if (parsed.empty) return setStatus(info, 'empty', 'Enter a formula');
    if (parsed.error) return setStatus(info, 'error', parsed.error);
    const φ = parsed.f;

    const cex = counterexample(context, φ);
    if (cex) {
      info.counterexample = cex;
      info.warning = context.length
        ? 'Dead end: this goal does not follow from its assumptions'
        : 'Not a tautology: this formula cannot be proved';
    }

    if (!node.rule.trim()) {
      if (node.premises.length === 0 && member(φ, context) && settings.implicitAx !== false) {
        info.implicitAx = true;
        return info;
      }
      return setStatus(info, 'open', node.premises.length ? 'Choose a rule' : 'Open goal');
    }
    if (!rule) return setStatus(info, 'error', `Unknown rule "${node.rule}"`);
    if (rule.classicalOnly && !classical) return setStatus(info, 'error', `${rule.label} is not available in intuitionistic logic`);
    if (allowed && !allowed.includes(ruleId)) return setStatus(info, 'error', `${rule.label} is not allowed here`);

    if (node.premises.length > rule.arity) {
      return setStatus(info, 'error', `${rule.label} takes ${rule.arity} premise(s), found ${node.premises.length}`);
    }
    if (node.premises.length < rule.arity) {
      return setStatus(info, 'incomplete', `${rule.label} needs ${rule.arity} premise(s), found ${node.premises.length}`);
    }
    if (premiseFormulas.some(f => f === null)) {
      return setStatus(info, 'incomplete', 'Fill in or fix the premises first');
    }
    const err = rule.check(φ, premiseFormulas, context);
    if (err) return setStatus(info, 'error', err);
    return info;
  };

  visit(root, settings.assumptions || []);

  const counts = { ok: 0, open: 0, error: 0, incomplete: 0, empty: 0 };
  for (const i of byId.values()) counts[i.status]++;
  return { byId, solved: counts.ok === byId.size, counts };
}

function setStatus(info, status, message) {
  info.status = status;
  info.message = message;
  return info;
}

/**
 * Applies a rule to a goal (like LogicProof's rule buttons): sets the rule name
 * and generates the premises. `extra` is the formula a rule asks for
 * (ψ for ⇒E, ¬E, ∧E; ψ ∨ χ for ∨E).
 */
export function applyRule(node, ruleId, extra = null, notation = 'unicode') {
  const rule = RULES[ruleId];
  node.rule = rule.label;
  let φ;
  try { φ = parseFormula(node.text); } catch { return; }
  if (!rule.premises || !rule.applies(φ)) {
    if (rule.arity === 0) node.premises = [];
    return;
  }
  if (rule.needs && !extra) return;
  if (node.premises.some(p => p.text.trim() || p.premises.length)) return;
  node.premises = rule.premises(φ, extra).map(p => newNode(show(p.f, notation)));
}

// Wrapper around the LogicProof ANTLR parser (src/parser/generated, MIT).
// Turns formula text into the canonical tree from src/core/formula.js.
import { CharStreams, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import GrammarLexer from './generated/GrammarLexer.js';
import GrammarParser from './generated/GrammarParser.js';
import MyGrammarListener from './generated/MyGrammarListener.js';
import { F } from '../core/formula.js';

export class ParseError extends Error {}

// ASCII notation -> symbols understood by the LogicProof grammar.
export function normalizeInput(text) {
  return text
    .replace(/_\|_/g, '⊥')
    .replace(/\|-/g, '⊢')
    .replace(/\/\\/g, '∧')
    .replace(/\\\//g, '∨')
    .replace(/<=>|<->/g, '⇔')
    .trim();
}

function runParser(text) {
  const errors = [];
  const listener = {
    syntaxError: (_r, _s, _line, col, msg) => errors.push({ col, msg }),
    reportAmbiguity() {},
    reportAttemptingFullContext() {},
    reportContextSensitivity() {},
  };
  const lexer = new GrammarLexer(CharStreams.fromString(text));
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new GrammarParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  const tree = parser.formula();
  if (errors.length) {
    throw new ParseError(`Syntax error at position ${errors[0].col + 1}`);
  }
  const ast = new MyGrammarListener();
  ParseTreeWalker.DEFAULT.walk(ast, tree);
  return ast.stack.pop();
}

// LogicProof AST -> canonical formula.
function fromLogicProof(n) {
  switch (n.type) {
    case 'parenthesis':
      return fromLogicProof(n.value);
    case 'atom':
      if (n.value === '⊥') return F.bot();
      if (n.value === '⊤') return F.top();
      return F.atom(String(n.value));
    case 'relation':
    case 'constant':
    case 'variable':
      return F.atom(n.name ?? n.value);
    case 'number':
      return F.atom(String(n.value ?? n.name));
    case 'negation': {
      let r = fromLogicProof(n.operand);
      for (let i = 0; i < (n.count || 1); i++) r = F.not(r);
      return r;
    }
    case 'conjunction':
      return F.and(fromLogicProof(n.left), fromLogicProof(n.right));
    case 'disjunction':
      return F.or(fromLogicProof(n.left), fromLogicProof(n.right));
    case 'implication':
      return F.imp(fromLogicProof(n.left), fromLogicProof(n.right));
    default:
      throw new ParseError('Only propositional logic is supported for now');
  }
}

const cache = new Map();

/** Parses a single formula. Throws ParseError. */
export function parseFormula(text) {
  const src = normalizeInput(text ?? '');
  if (!src) throw new ParseError('Empty formula');
  if (cache.has(src)) return cache.get(src);
  if (src.includes('⇔')) throw new ParseError('Equivalence (<->) is not supported yet');
  const ast = runParser(src);
  if (!ast || Array.isArray(ast) || ast.type === 'sequent') {
    throw new ParseError('Expected a single formula');
  }
  const f = fromLogicProof(ast);
  cache.set(src, f);
  return f;
}

/** Parses a sequent "Γ ⊢ φ" or just "φ". */
export function parseSequent(text) {
  const src = normalizeInput(text);
  const i = src.indexOf('⊢');
  if (i < 0) return { assumptions: [], goal: parseFormula(src) };
  const left = src.slice(0, i).trim();
  return {
    assumptions: left ? splitTopLevel(left).map(parseFormula) : [],
    goal: parseFormula(src.slice(i + 1)),
  };
}

function splitTopLevel(s) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.trim()).filter(Boolean);
}

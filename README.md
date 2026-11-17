# OnlineProver 2.0

A web app for natural deduction proofs in Gentzen style. Enter a formula, then build the proof
tree by choosing rules; every step is checked immediately. The checking core (grammar, parser,
rules) is ported from [LogicProof](https://github.com/6ximik9/naturalDeduction) (MIT) and the
proof workflow follows LogicProof.

Status: early prototype with two screens only - formula input and proof.
Propositional logic, classical rules, nothing is saved: reloading the page starts over.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # core tests (vitest)
npm run build    # production build into dist/
```

## Usage

1. Enter a formula or a sequent `Γ ⊢ φ`. ASCII is converted to logic symbols while you type:
   `->` ⇒, `&` or `/\` ∧, `|` or `\/` ∨, `~` ¬, `_|_` ⊥, `|-` ⊢. If the formula is not a
   tautology, a counterexample is shown.
2. The proof screen shows the goal `⊢ φ`. Click an open goal (dashed) to select it.
3. Click a rule card on the left. Only rules applicable to the selected goal are enabled.
   ⇒E, ¬E, ∧E and ∨E ask for the missing formula and suggest candidates: "Suggested" ones
   fit a hypothesis (the best one is prefilled), "From the proof" are subformulas of the
   hypotheses. Click a chip to use it, double-click to apply at once.
4. The Hypotheses panel lists Γ of the selected node and which rule introduced each one.
   A hypothesis equal to the goal is marked; clicking it closes the goal with Ax. While a rule
   asks for a formula, clicking a hypothesis inserts it.
5. After each step the next open goal is selected. Close leaves with Ax.
   Hover a sequent to see its full context Γ. Undo or Ctrl+Z reverts a step.

## Structure

```
src/parser/generated/   LogicProof grammar and ANTLR parser (unchanged)
src/parser/parse.js     text -> canonical formulas
src/core/formula.js     formulas, equality, printing, truth tables, counterexamples
src/core/rules.js       Gentzen rules as pure functions (checking + premise generation)
src/core/proof.js       proof tree, contexts, per-step validation
src/core/symbols.js     live ASCII -> logic symbol conversion
src/core/suggest.js     formula suggestions for ⇒E, ∧E, ∨E, ¬E
src/main.js, style.css  UI
tests/                  core tests
```

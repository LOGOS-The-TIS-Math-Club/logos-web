"use client";

import { useEffect, useState } from "react";

import { prefersReducedMotion } from "./motion-preference";

/*
 * Something worth doing while the application service wakes.
 *
 * The database sleeps after five minutes idle, so the first visitor after a
 * quiet period waits several seconds. Rather than a spinner, offer a problem:
 * it fits the club, and it turns dead time into the thing the club is about.
 *
 * Deliberately self-contained — no scoring, no persistence, nothing to lose if
 * the page navigates away mid-thought.
 */

interface Problem {
  readonly question: string;
  readonly answer: string;
  readonly why: string;
}

const PROBLEMS: readonly Problem[] = [
  {
    question: "What is the last digit of 7¹⁰⁰?",
    answer: "1",
    why: "Last digits of powers of 7 cycle 7, 9, 3, 1. Since 100 is divisible by 4, we land on the end of the cycle.",
  },
  {
    question: "A number is doubled, then 6 is added, giving 20. What was it?",
    answer: "7",
    why: "Work backwards: 20 − 6 = 14, then 14 ÷ 2 = 7.",
  },
  {
    question: "How many diagonals does a regular octagon have?",
    answer: "20",
    why: "Each of 8 vertices joins 5 non-adjacent vertices, and every diagonal is counted twice: 8 × 5 ÷ 2.",
  },
  {
    question: "If x + 1/x = 3, what is x² + 1/x²?",
    answer: "7",
    why: "Square both sides: x² + 2 + 1/x² = 9, so x² + 1/x² = 7. No need to find x.",
  },
  {
    question: "What is the sum of the first 100 positive integers?",
    answer: "5050",
    why: "Pair 1 with 100, 2 with 99, and so on — 50 pairs each summing to 101.",
  },
  {
    question:
      "Two fair coins are flipped. Given at least one is heads, what is the probability both are?",
    answer: "1/3",
    why: "The equally likely cases are HH, HT, TH — TT is ruled out. Only one of the three has two heads.",
  },
  {
    question: "What is the remainder when 2¹⁰ is divided by 7?",
    answer: "2",
    why: "2³ = 8 ≡ 1 (mod 7), so 2⁹ ≡ 1 and 2¹⁰ ≡ 2.",
  },
];

/** Rotates to the next problem on this interval when the answer is not shown. */
const ROTATE_MS = 9000;

export function WaitingProblems() {
  // Starts deterministic so the server and client markup agree on first paint;
  // the rotation below provides the variety.
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;
    if (prefersReducedMotion()) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % PROBLEMS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [revealed]);

  const problem = PROBLEMS[index];

  return (
    <div className="panel ruled-left space-y-5 border-l-2 p-6 sm:p-8">
      <p className="eyebrow">While you wait</p>

      <p
        className="text-lg leading-relaxed font-medium text-balance"
        aria-live="polite"
      >
        {problem.question}
      </p>

      {revealed ? (
        <div className="space-y-2">
          <p className="datum text-primary text-2xl">{problem.answer}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {problem.why}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={revealed}
          className="action action-sm"
        >
          <span className="action-label">Show answer</span>
          <span className="action-label-hover" aria-hidden="true">
            Show answer
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setIndex((current) => (current + 1) % PROBLEMS.length);
          }}
          className="action action-sm action-quiet"
        >
          <span className="action-label">Another</span>
          <span className="action-label-hover" aria-hidden="true">
            Another
          </span>
        </button>
      </div>
    </div>
  );
}

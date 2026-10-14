import { nietzsche } from "./data/nietzsche";
import { socrates } from "./data/socrates";
import type { Concept, Philosopher, Quote } from "./types";

export type { Concept, Field, Group, Philosopher, Quote } from "./types";

/** 名簿の38人の id。並びは設計書 3章の表（名簿のページ・指示文の順） */
export const ROSTER_IDS: readonly string[] = [
	"socrates", "plato", "aristotle", "epicurus", "seneca", "epictetus", "marcus-aurelius",
	"buddha", "confucius", "laozi", "zhuangzi", "wang-yangming",
	"montaigne", "pascal", "spinoza", "kant", "schopenhauer", "mill", "kierkegaard", "nietzsche",
	"alain", "russell", "sartre", "beauvoir", "camus", "arendt", "weil", "fromm",
	"kenko", "chomei", "shinran", "dogen", "nishida", "miki",
	"adler", "freud", "jung",
	"carnegie",
];

const ALL: Philosopher[] = [socrates, nietzsche];

export const PHILOSOPHERS: readonly Philosopher[] = [...ALL].sort(
	(a, b) => ROSTER_IDS.indexOf(a.id) - ROSTER_IDS.indexOf(b.id),
);

const BY_ID = new Map(PHILOSOPHERS.map((p) => [p.id, p]));
const CONCEPTS = new Map<string, Concept>(PHILOSOPHERS.flatMap((p) => p.concepts.map((c) => [c.id, c] as const)));
const QUOTES = new Map<string, Quote>(PHILOSOPHERS.flatMap((p) => p.quotes.map((q) => [q.id, q] as const)));

export const philosopherById = (id: string): Philosopher | undefined => BY_ID.get(id);
export const conceptById = (id: string): Concept | undefined => CONCEPTS.get(id);
export const quoteById = (id: string): Quote | undefined => QUOTES.get(id);

import { adler } from "./data/adler";
import { alain } from "./data/alain";
import { arendt } from "./data/arendt";
import { aristotle } from "./data/aristotle";
import { beauvoir } from "./data/beauvoir";
import { buddha } from "./data/buddha";
import { camus } from "./data/camus";
import { carnegie } from "./data/carnegie";
import { chomei } from "./data/chomei";
import { confucius } from "./data/confucius";
import { dogen } from "./data/dogen";
import { epictetus } from "./data/epictetus";
import { epicurus } from "./data/epicurus";
import { freud } from "./data/freud";
import { fromm } from "./data/fromm";
import { jung } from "./data/jung";
import { kant } from "./data/kant";
import { kenko } from "./data/kenko";
import { kierkegaard } from "./data/kierkegaard";
import { laozi } from "./data/laozi";
import { marcusAurelius } from "./data/marcus-aurelius";
import { miki } from "./data/miki";
import { mill } from "./data/mill";
import { montaigne } from "./data/montaigne";
import { nietzsche } from "./data/nietzsche";
import { nishida } from "./data/nishida";
import { pascal } from "./data/pascal";
import { plato } from "./data/plato";
import { russell } from "./data/russell";
import { sartre } from "./data/sartre";
import { schopenhauer } from "./data/schopenhauer";
import { seneca } from "./data/seneca";
import { shinran } from "./data/shinran";
import { socrates } from "./data/socrates";
import { spinoza } from "./data/spinoza";
import { wangYangming } from "./data/wang-yangming";
import { weil } from "./data/weil";
import { zhuangzi } from "./data/zhuangzi";
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

const ALL: Philosopher[] = [adler, alain, arendt, aristotle, beauvoir, buddha, camus, carnegie, chomei, confucius, dogen, epictetus, epicurus, freud, fromm, jung, kant, kenko, kierkegaard, laozi, marcusAurelius, miki, mill, montaigne, nietzsche, nishida, pascal, plato, russell, sartre, schopenhauer, seneca, shinran, socrates, spinoza, wangYangming, weil, zhuangzi];

export const PHILOSOPHERS: readonly Philosopher[] = [...ALL].sort(
	(a, b) => ROSTER_IDS.indexOf(a.id) - ROSTER_IDS.indexOf(b.id),
);

const BY_ID = new Map(PHILOSOPHERS.map((p) => [p.id, p]));
const CONCEPTS = new Map<string, Concept>(PHILOSOPHERS.flatMap((p) => p.concepts.map((c) => [c.id, c] as const)));
const QUOTES = new Map<string, Quote>(PHILOSOPHERS.flatMap((p) => p.quotes.map((q) => [q.id, q] as const)));

export const philosopherById = (id: string): Philosopher | undefined => BY_ID.get(id);
export const conceptById = (id: string): Concept | undefined => CONCEPTS.get(id);
export const quoteById = (id: string): Quote | undefined => QUOTES.get(id);

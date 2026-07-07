import type { Sample } from "../types/sample";
import { matchesFuzzySearch } from "./search";

type NumberRange = {
  min: number | null;
  max: number | null;
};

type SampleSearchDsl = {
  textTerms: string[];
  excludedTerms: string[];
  bpm: NumberRange | null;
  playbackType: string | null;
  instrumentType: string | null;
  key: string | null;
  tags: string[];
  excludedTags: string[];
  favorite: boolean | null;
};

export function parseSampleSearchDsl(query: string): SampleSearchDsl {
  const parsed: SampleSearchDsl = {
    textTerms: [],
    excludedTerms: [],
    bpm: null,
    playbackType: null,
    instrumentType: null,
    key: null,
    tags: [],
    excludedTags: [],
    favorite: null,
  };

  const tokens = tokenize(query);
  if (tokens.length === 0 && query.trim()) {
    pushText(parsed, false, query);
    return parsed;
  }

  for (const token of tokens) {
    const negated = token.startsWith("-") && token.length > 1;
    const body = negated ? token.slice(1) : token;
    const separator = body.indexOf(":");

    if (separator === -1) {
      pushText(parsed, negated, body);
      continue;
    }

    const field = normalizeField(body.slice(0, separator));
    const value = body.slice(separator + 1).trim();
    if (!value) {
      pushText(parsed, negated, body);
      continue;
    }

    switch (field) {
      case "bpm":
        if (!negated) parsed.bpm = parseNumberRange(value);
        break;
      case "type":
      case "playback":
      case "playbacktype":
      case "sampletype":
        if (!negated) parsed.playbackType = normalizePlaybackType(value);
        break;
      case "instrument":
      case "instrumenttype":
        if (!negated) parsed.instrumentType = normalizeValue(value);
        break;
      case "key":
        if (!negated) parsed.key = normalizeKey(value);
        break;
      case "tag":
      case "tags":
        pushTag(parsed, negated, value);
        break;
      case "favorite":
      case "favourite":
      case "fav":
        if (!negated) parsed.favorite = parseBoolean(value);
        break;
      default:
        pushText(parsed, negated, body);
        break;
    }
  }

  return parsed;
}

export function matchesSampleSearchDsl(query: string, sample: Sample, isFavorite = false) {
  const parsed = parseSampleSearchDsl(query);
  const targets = [sample.file_name, ...sample.tags];

  for (const term of parsed.textTerms) {
    if (!matchesFuzzySearch(term, targets)) return false;
  }

  for (const term of parsed.excludedTerms) {
    if (matchesFuzzySearch(term, targets)) return false;
  }

  if (parsed.bpm && !matchesNumberRange(sample.bpm, parsed.bpm)) return false;
  if (parsed.playbackType && normalizePlaybackLabel(sample.playback_type) !== parsed.playbackType && normalizePlaybackLabel(sample.sample_type) !== parsed.playbackType) return false;
  if (parsed.instrumentType && normalizeValue(sample.instrument_type) !== parsed.instrumentType) return false;
  if (parsed.key && normalizeKey(sample.musical_key ?? "") !== parsed.key) return false;
  if (parsed.favorite !== null && isFavorite !== parsed.favorite) return false;

  for (const tag of parsed.tags) {
    if (!sample.tags.some((sampleTag) => normalizeValue(sampleTag) === tag)) return false;
  }

  for (const tag of parsed.excludedTags) {
    if (sample.tags.some((sampleTag) => normalizeValue(sampleTag) === tag)) return false;
  }

  return true;
}

function tokenize(query: string) {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of query) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (/\s/u.test(char) && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

function pushText(parsed: SampleSearchDsl, negated: boolean, value: string) {
  const normalized = normalizeValue(value);
  if (!normalized) return;
  if (negated) parsed.excludedTerms.push(normalized);
  else parsed.textTerms.push(normalized);
}

function pushTag(parsed: SampleSearchDsl, negated: boolean, value: string) {
  const normalized = normalizeValue(value);
  if (!normalized) return;
  if (negated) parsed.excludedTags.push(normalized);
  else parsed.tags.push(normalized);
}

function parseNumberRange(value: string): NumberRange | null {
  const separator = value.indexOf("-");
  if (separator !== -1) {
    const range = {
      min: parseNumber(value.slice(0, separator)),
      max: parseNumber(value.slice(separator + 1)),
    };
    return range.min !== null || range.max !== null ? range : null;
  }

  const number = parseNumber(value);
  return number === null ? null : { min: number, max: number };
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesNumberRange(value: number | null, range: NumberRange) {
  if (value === null) return false;
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
}

function parseBoolean(value: string) {
  const normalized = normalizeValue(value);
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function normalizeField(value: string) {
  return normalizeValue(value).replace(/[_-]/gu, "");
}

function normalizeValue(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function normalizePlaybackType(value: string) {
  const normalized = normalizePlaybackLabel(value);
  return normalized === "loop" || normalized === "oneshot" ? normalized : null;
}

function normalizePlaybackLabel(value: string) {
  const normalized = normalizeValue(value).replace(/[_\s-]/gu, "");
  if (normalized === "one" || normalized === "shot" || normalized === "oneshot") return "oneshot";
  return normalized;
}

function normalizeKey(value: string) {
  const normalized = normalizeValue(value);
  const withoutMinor = normalized.endsWith("m") ? normalized.slice(0, -1) : normalized;
  if (!withoutMinor) return null;

  const root = withoutMinor[0].toUpperCase();
  const suffix = withoutMinor.slice(1);
  const key = suffix === "b" ? normalizeFlatKey(root) : `${root}${suffix}`;
  const allowed = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return key && allowed.includes(key) ? key : null;
}

function normalizeFlatKey(root: string) {
  const flats: Record<string, string> = {
    D: "C#",
    E: "D#",
    G: "F#",
    A: "G#",
    B: "A#",
  };
  return flats[root] ?? null;
}

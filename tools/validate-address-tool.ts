// Vapi Code Tool: Validate Address
// This tool fetches the service area street list from GitHub and fuzzy-matches
// the street name heard by the agent against known streets.
//
// Parameters:
//   streetName (string) - The street name as heard from the caller
//
// Environment Variables:
//   STREET_LIST_URL - Raw GitHub URL to the service-area-streets.txt file
//
// Returns:
//   { exactMatch, bestMatches[], suggestion }

const { streetName } = args;
const { STREET_LIST_URL } = env;

// Fetch the street list
const response = await fetch(STREET_LIST_URL);
const text = await response.text();
const streets = text.trim().split("\n").map((s: string) => s.trim()).filter((s: string) => s.length > 0);

// Normalize for comparison
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const input = normalize(streetName);

// 1. Try exact match
const exactMatch = streets.find((s: string) => normalize(s) === input);
if (exactMatch) {
  return {
    exactMatch: true,
    matchedStreet: exactMatch,
    bestMatches: [exactMatch],
    suggestion: `The street "${exactMatch}" is a valid street in our service area.`
  };
}

// 2. Compute edit distance (Levenshtein) for fuzzy matching
const editDistance = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

// 3. Score all streets and find the closest matches
const scored = streets.map((s: string) => ({
  street: s,
  distance: editDistance(input, normalize(s))
}));

scored.sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

const bestMatches = scored.slice(0, 5).map((s: { street: string }) => s.street);
const topDistance = scored[0].distance;

let suggestion: string;
if (topDistance <= 2) {
  suggestion = `Did the caller mean "${bestMatches[0]}"? This is the closest match to what was heard ("${streetName}").`;
} else if (topDistance <= 4) {
  suggestion = `No exact match found for "${streetName}". Closest options: ${bestMatches.slice(0, 3).join(", ")}. Please ask the caller to confirm or repeat the street name.`;
} else {
  suggestion = `"${streetName}" does not closely match any street in our service area. Please ask the caller to repeat or spell the street name.`;
}

return {
  exactMatch: false,
  bestMatches,
  suggestion
};

// Get the incoming webhook data - try multiple paths since n8n structures it differently
const webhookData = $('Vapi Tool Webhook').first().json;

// Vapi sends: { message: { toolCallList: [...] } }
// n8n may put this at .body, or directly at the root
let message;
if (webhookData.body && webhookData.body.message) {
  message = webhookData.body.message;
} else if (webhookData.message) {
  message = webhookData.message;
} else {
  return [{
    json: {
      results: [{
        toolCallId: "unknown",
        result: JSON.stringify({
          error: true,
          debug: "Could not find message in webhook data",
          receivedKeys: Object.keys(webhookData),
          fullData: JSON.stringify(webhookData).substring(0, 500)
        })
      }]
    }
  }];
}

const toolCall = message.toolCallList[0];
const toolCallId = toolCall.id;
const streetName = (toolCall.arguments && toolCall.arguments.streetName) || "";

if (!streetName) {
  return [{
    json: {
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify({
          error: true,
          suggestion: "No street name was provided. Please ask the caller for their street name."
        })
      }]
    }
  }];
}

// Get the street list from the HTTP request
const fetchResult = $('Fetch Street List').first().json;
let streetText = "";
if (typeof fetchResult === "string") {
  streetText = fetchResult;
} else if (typeof fetchResult.data === "string") {
  streetText = fetchResult.data;
} else if (fetchResult.body && typeof fetchResult.body === "string") {
  streetText = fetchResult.body;
} else {
  streetText = JSON.stringify(fetchResult);
}

const streets = streetText.trim().split("\n").map(s => s.trim()).filter(s => s.length > 0);

// Normalize for comparison
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const input = normalize(streetName);

// 1. Try exact match
const exactMatch = streets.find(s => normalize(s) === input);
if (exactMatch) {
  return [{
    json: {
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify({
          exactMatch: true,
          matchedStreet: exactMatch,
          bestMatches: [exactMatch],
          suggestion: "The street " + exactMatch + " is a valid street in our service area."
        })
      }]
    }
  }];
}

// 2. Compute edit distance (Levenshtein) for fuzzy matching
const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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

// 3. Score all streets and find closest matches
const scored = streets.map(s => ({
  street: s,
  distance: editDistance(input, normalize(s))
}));

scored.sort((a, b) => a.distance - b.distance);

const bestMatches = scored.slice(0, 5).map(s => s.street);
const topDistance = scored[0].distance;

let suggestion;
if (topDistance <= 2) {
  suggestion = "Did the caller mean " + bestMatches[0] + "? This is the closest match to what was heard (" + streetName + ").";
} else if (topDistance <= 4) {
  suggestion = "No exact match found for " + streetName + ". Closest options: " + bestMatches.slice(0, 3).join(", ") + ". Please ask the caller to confirm or repeat the street name.";
} else {
  suggestion = streetName + " does not closely match any street in our service area. Please ask the caller to repeat or spell the street name.";
}

return [{
  json: {
    results: [{
      toolCallId: toolCallId,
      result: JSON.stringify({
        exactMatch: false,
        bestMatches: bestMatches,
        suggestion: suggestion
      })
    }]
  }
}];

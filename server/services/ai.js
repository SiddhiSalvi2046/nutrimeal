
//AI.JS
const axios = require("axios");

function mockRecipe(query) {
  // Simple mock so you can test immediately
  const title = `${query[0].toUpperCase() + query.slice(1)} — Chef’s Quick Version`;
  return {
    name: title,
    ingredients: [
      { name: "Olive oil", amount: "1 tbsp", calories: 119 },
      { name: query, amount: "200 g", calories: Math.floor(200 + Math.random() * 120) },
      { name: "Onion", amount: "1 small", calories: 28 },
      { name: "Garlic", amount: "2 cloves", calories: 9 },
      { name: "Salt", amount: "to taste", calories: 0 },
      { name: "Black pepper", amount: "1/2 tsp", calories: 3 },
    ],
    steps: [
      "Prep ingredients (chop onion and garlic).",
      `Heat oil, add ${query}, sauté until fragrant.`,
      "Add onion and garlic; cook until soft.",
      "Season with salt & pepper; adjust to taste.",
      "Serve warm. Optional: garnish with herbs."
    ],
    nutrition: { totalCalories: 0, servings: 2, caloriesPerServing: 0 },
  };
}

/**
 * generateRecipeWithAI(query)
 * - If MOCK_AI=true -> returns a realistic mock.
 * - Otherwise, calls your AI provider (fill AI_API_URL, AI_API_KEY, AI_MODEL in .env).
 *   Adjust payload to match your provider's API.
 */
async function generateRecipeWithAI(query) {
  if (String(process.env.MOCK_AI).toLowerCase() === "true") {
    return mockRecipe(query);
  }

  const url = process.env.AI_API_URL;
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!url || !key || !model) {
    console.warn("AI is not configured. Falling back to mock.");
    return mockRecipe(query);
  }

  const prompt = `
You are a recipe generator. Return only valid JSON matching this schema:

{
  "name": "Recipe name",
  "ingredients": [
    {"name": "string", "amount": "e.g. 200 g", "calories": number}
  ],
  "steps": ["step 1", "step 2", "..."],
  "nutrition": {"totalCalories": number, "servings": number, "caloriesPerServing": number}
}

Task: Create a healthy, tasty recipe for "${query}". Estimate calories per ingredient for the given amount. Ensure JSON is strictly valid.
`;

  try {
    // EXAMPLE generic JSON-style request (adjust to your provider’s docs)
    const resp = await axios.post(
      url,
      {
        model,
        input: prompt,
        // Some providers use {messages:[{role:"user", content: prompt}]} instead.
        // Change this to match your provider’s required format.
        response_format: { type: "json_object" }
      },
      { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, timeout: 30000 }
    );

    // Providers return different shapes. Try common fields first:
    const data = resp.data;

    // If provider returns plain JSON string in some field, parse it.
    const maybeJSON =
      data?.output?.[0]?.content?.[0]?.text || // some providers
      data?.choices?.[0]?.message?.content ||  // chat-like providers
      data?.content ||                         // generic
      data;                                    // already JSON

    if (typeof maybeJSON === "string") {
      return JSON.parse(maybeJSON);
    }
    return maybeJSON;
  } catch (err) {
    console.error("AI error:", err?.response?.data || err.message);
    return mockRecipe(query); // don’t crash the app; return a mock instead
  }
}

module.exports = { generateRecipeWithAI };


//NORMALIZE.JS
function normalizeIngredients(ings) {
  return ings.map((ing) => {
    if (typeof ing === "string") {
      // Try to split into quantity + item (very basic)
      const parts = ing.split(" ");
      const qty = isNaN(parts[0]) ? "" : parts.shift();
      return { quantity: qty, unit: "", item: parts.join(" ") };
    }
    return ing; // already object
  });
}
const normalizedIngredients = normalizeIngredients(recipe.ingredients);

db.query(
  "INSERT INTO recipes (name, ingredients, calories, instructions) VALUES (?, ?, ?, ?)",
  [
    recipe.name,
    JSON.stringify(normalizedIngredients),
    recipe.calories || null,
    JSON.stringify(recipe.steps),
  ],
  (err, result) => {
    if (err) {
      console.error("❌ Failed to save recipe:", err.message);
    } else {
      console.log("✅ Recipe saved to DB:", recipe.name);
    }
  }
);

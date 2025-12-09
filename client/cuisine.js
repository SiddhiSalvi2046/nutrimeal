
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const cuisine = params.get("cuisine");

  const title = document.getElementById("cuisine-title");
  const recipeList = document.getElementById("cuisine-recipes");

  if (!cuisine) {
    title.textContent = "No cuisine selected!";
    return;
  }

  title.textContent = `${cuisine} Recipes`;

  try {
    const res = await fetch(`/api/cuisine/${cuisine}`);
    const recipes = await res.json();

    recipeList.innerHTML = "";

    recipes.forEach(r => {
      const card = document.createElement("div");
      card.classList.add("recipe-card");

      card.innerHTML = `
<div class="recipe-image-wrapper"> 
<img src="${r.image_url}" alt="${r.name}" class="recipe-img">
</div>
<h3>${r.name}</h3>

<div class="btn-container">  
<a href="recipe.html?id=${r.id}" class="btn view-btn">View Recipe</a>
</div>
 `;

      recipeList.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    recipeList.textContent = "Failed to load recipes.";
  }
});

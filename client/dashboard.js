let currentUserData = {};
let currentRecipeId = null;
const getUserToken = () => localStorage.getItem('auth_token');
function showPopup(message) {
    const popup = document.getElementById("customPopup");
    const popupMessage = document.getElementById("popupMessage");
    popupMessage.textContent = message;
    popup.style.display = "block";
    document.getElementById("closePopup").onclick = () => {
        popup.style.display = "none";
    };
    window.onclick = (e) => {
        if (e.target === popup) {
            popup.style.display = "none";
        }
    };
}

async function loadUserData() { 
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    const token = getUserToken(); 

    if (!nameInput || !emailInput || !token) {
        if (!token) console.error("No authentication token found.");
        return; 
    }
    try {
        const res = await fetch('/api/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });
        
        if (!res.ok) {
            throw new Error(`Failed to fetch user profile: ${res.statusText}`);
        }
        const data = await res.json(); 
        
        currentUserData = {
            name: data.name || "N/A",
            email: data.email || "N/A"
        };
        
    } catch (error) {
        console.error("Error loading user data:", error);
        currentUserData = { name: "Error", email: "Error" };
    }
    nameInput.value = currentUserData.name;
    emailInput.value = currentUserData.email;
}

async function toggleEditMode(button) { 
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    if (!nameInput || !emailInput) return; 
    if (button.textContent === 'Edit Profile') {
        nameInput.disabled = false;
        emailInput.disabled = false;
        button.textContent = 'Save Changes';
        button.classList.remove('btn-primary');
        button.classList.add('btn-secondary'); 
        nameInput.focus();
    } else {
        const newName = nameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const token = getUserToken();
        if (!newName || !newEmail) {
            showPopup("Name and Email cannot be empty.");
            return; 
        }
        if (!token) {
             showPopup("Session token missing. Please log in again.");
             return;
        }
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    name: newName, 
                    email: newEmail 
                })
            });

            const data = await res.json();

            if (!res.ok) {
    console.error("Server responded with HTTP Status:", res.status); 
    const errorText = await res.text();
    console.error("Raw response content:", errorText.substring(0, 100) + '...');
    throw new Error(`Failed to update profile. Status: ${res.status}`);
}
       
        currentUserData.name = newName;
        currentUserData.email = newEmail;
        nameInput.disabled = true;
        emailInput.disabled = true;
        button.textContent = 'Edit Profile';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-primary');
        const welcomeTextElement = document.getElementById("welcome-text");
            if (welcomeTextElement) {
                 welcomeTextElement.textContent = `Welcome, ${newName}! 🎉`;
            } 
        showPopup(`Profile updated successfully! New Name: ${newName}`);
        } catch (error) {
            console.error("Error saving profile:", error);
            showPopup(`Profile update failed: ${error.message}. Please try again.`);
        }
        
    }
}
    

function toggleProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal.style.display !== "flex") {
        loadUserData();
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }
}

function logoutUser() {
    // Close profile modal if open
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = "none";

    // Clear authentication tokens and user info
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username'); // if you store it
    sessionStorage.removeItem('userSession'); // optional if used

    // Redirect to login/home page
    window.location.href = "index.html";
}


window.onclick = function(event) {
    const modal = document.getElementById('profileModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
}

function handleAvatarUpload() {
    showPopup("Triggering image upload dialog. (Requires backend integration)");
}

async function fetchAndRenderFavourites() {
    const favouritesSection = document.getElementById("favourites-section");
    const token = getUserToken();
    if (!favouritesSection) return;
    let container = favouritesSection.querySelector('#favourites-list-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'favourites-list-container';
        favouritesSection.appendChild(container);
    }
    container.innerHTML = "<p>Loading favourites...</p>";
    if (!token) {
        container.innerHTML = "<p>⚠️ Please log in to view your favourite recipes.</p>";
        return;
    }
    try {
        const res = await fetch('/api/favourites', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401) {
                 container.innerHTML = "<p>Session expired. Please log in again.</p>";
                 return;
            }
            throw new Error("Failed to fetch favourites.");
        }
        const recipes = await res.json();
        renderFavourites(recipes);
    } catch (error) {
        console.error("Error fetching favourites:", error);
        container.innerHTML = `<p>❌ Error loading favourites: ${error.message}</p>`;
    }
}
function renderFavourites(recipes) {
    const favouritesSection = document.getElementById("favourites-section");
    const container = favouritesSection.querySelector('#favourites-list-container');
    if (recipes.length === 0) {
        container.innerHTML = "<p class='empty-state-message'>No recipes added to favourites yet. Go add some!</p>";
    } else {
        container.innerHTML = ""; 
        recipes.forEach(r => {
            const card = document.createElement("div");
            card.className = "recipe-card fav-card"; 
            card.innerHTML = `
                <img src="${r.image_url || 'placeholder.jpg'}" alt="${r.name}" class="recipe-img">
                <h3>${r.name}</h3>
                <div class="card-actions">
                    <a href="recipe.html?id=${r.id}" class="btn view-btn">View Recipe</a>
                    <button class="btn remove-fav-btn" data-id="${r.id}">❌ Remove</button>
                </div>
            `;
            container.appendChild(card);
        });
        document.querySelectorAll('.remove-fav-btn').forEach(button => {
            button.addEventListener('click', handleRemoveFavourite);
        });
    }
}

async function handleRemoveFavourite(event) {
    const recipeId = event.target.dataset.id;
    const token = getUserToken();
    if (!token) {
        showPopup("You must be logged in to remove favourites.");
        return;
    }
    if (!confirm("Are you sure you want to remove this recipe?")) {
        return;
    }
    try {
        const res = await fetch(`/api/favourites/${recipeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (res.ok) {
            showPopup(data.message || "Recipe removed.");
            fetchAndRenderFavourites();
        } else {
            showPopup(data.error || "Failed to remove favourite.");
        }
    } catch (error) {
        console.error("Error removing favourite:", error);
        showPopup("Network error during removal.");
    }
}

const capitalize = (s) => (s && s[0].toUpperCase() + s.slice(1)) || s;
function openMealPlanModal(recipeId) {
    currentRecipeId = recipeId;
    const modal = document.getElementById('mealPlanModal');
    modal.classList.remove('hidden');
    document.getElementById('mealplan-section').classList.add('active');
    document.querySelectorAll('.section').forEach(sec => {
        if (sec.id !== 'mealplan-section') {
            sec.classList.remove('active');
        }
    });
}

document.getElementById('closeMealModal')?.addEventListener('click', () => {
    document.getElementById('mealPlanModal').classList.add('hidden');
});

document.getElementById('confirmAddToPlan')?.addEventListener('click', async () => {
    if (!currentRecipeId) return;
    const day = document.getElementById('mealDay').value;
    const type = document.getElementById('mealType').value;
    const token = localStorage.getItem('auth_token');
    if (!token) {
        showPopup("Please log in.");
        return;
    }
    try {
        const res = await fetch('/api/mealplan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                recipe_id: currentRecipeId,
                day_of_week: day,
                meal_type: capitalize(type)
            })
        });
        if (res.ok) {
            showPopup(`Successfully added to ${day}'s ${type}!`);
            document.getElementById('mealPlanModal').classList.add('hidden');
            fetchAndRenderMealPlan();
        } else {
            showPopup("Failed to add to meal plan.");
        }
    } catch (error) {
        console.error("Error adding to meal plan:", error);
    }
});
async function handleSaveMealPlan() {
    if (!currentRecipeId) return;
    const day = document.getElementById('meal-day').value; 
    const type = document.getElementById('meal-type').value; 
    const token = localStorage.getItem('auth_token');
    if (!token) {
        showPopup("Please log in to save your meal plan.");
        return;
    }
    try {
        const res = await fetch('/api/mealplan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                recipe_id: currentRecipeId,
                day_of_week: day,
                meal_type:  capitalize(type)
            })
        });
        const data = await res.json();
        if (res.ok) {
            showPopup(data.message || `Successfully added to ${day}'s ${type}!`);
            const modal = document.getElementById('mealPlanModal');
            if (modal) modal.classList.add('hidden');
            window.location.href = "dashboard.html#mealplan-section";
            fetchAndRenderMealPlan();
        } else {
            showPopup(data.error || "Failed to add to meal plan.");
        }
    } catch (error) {
        console.error("Error saving meal plan:", error);
        showPopup("Network error during meal plan save.");
    }

}

async function fetchAndRenderMealPlan() {
    const container = document.getElementById("meal-plan-container");
    const token = localStorage.getItem('auth_token');
    if (!container) return;
    container.innerHTML = "<p>Loading meal plan...</p>";
    if (!token) {
        container.innerHTML = "<p>⚠️ Please log in to view your meal plan.</p>";
        return;
    }
    try {
        const res = await fetch('/api/mealplan', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch meal plan.");
        const meals = await res.json();
        const weeklyPlan = {
            'Monday': {}, 'Tuesday': {}, 'Wednesday': {}, 'Thursday': {},
            'Friday': {}, 'Saturday': {}, 'Sunday': {}
        };
        meals.forEach(meal => {
            const day = meal.day_of_week;
            const type = capitalize(meal.meal_type);
            if (!weeklyPlan[day][type]) weeklyPlan[day][type] = [];
            weeklyPlan[day][type].push({
                name: meal.name,
                recipeId: meal.recipe_id,
                id: meal.meal_plan_entry_id,
                imageUrl: meal.image_url
            });
        });
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
        let html = '<table class="meal-table"><thead><tr><th>Day</th>';
        mealTypes.forEach(type => html += `<th>${type}</th>`);
        html += '</tr></thead><tbody>';
        daysOfWeek.forEach(day => {
            html += `<tr><td><strong>${day}</strong></td>`;
            mealTypes.forEach(type => {
                const mealArray = weeklyPlan[day][type];
                if (mealArray && mealArray.length > 0) {
                    html += `<td>`;
                    mealArray.forEach(meal => {
                        html += `
                            <a href="recipe.html?id=${meal.recipeId}" title="View Recipe">
                                <img src="${meal.imageUrl || 'placeholder.jpg'}" alt="${meal.name}" width="80" height="80">
                                <p>${meal.name}</p>
                            </a>
                            <button class="btn small btn-dislike remove-dish"
                                    data-id="${meal.id}" data-day="${day}" data-type="${type.toLowerCase()}">
                                Remove
                            </button>`;
                    });
                    html += `</td>`;
                } else {
                    html += `<td>-</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        document.querySelectorAll('.remove-dish').forEach(btn => {
            btn.addEventListener('click', handleRemoveMeal);
        });

    } catch (error) {
        console.error("Error fetching meal plan:", error);
        container.innerHTML = `<p>❌ Error loading meal plan: ${error.message}</p>`;
    }
}
async function handleRemoveMeal(event) {
    const btn = event.currentTarget;
    const mealId = btn.dataset.id;
    const day = btn.dataset.day;
    const type = btn.dataset.type; 
    const token = localStorage.getItem('auth_token');
    if (!mealId) {
        console.error("Meal ID missing on the button!");
        showPopup("Cannot remove meal: Unique ID not found.");
        return;
    }
    if (!confirm(`Are you sure you want to remove the meal for ${day} ${type}?`)) {
        return;
    }
    try {
        const res = await fetch(`/api/mealplan/${mealId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                day_of_week: day,
                meal_type: type 
            })
        });
        if (res.ok) {
            showPopup('Meal removed successfully!');
            fetchAndRenderMealPlan();
        } else {
            const data = await res.json();
            showPopup(data.error || 'Failed to remove meal.');
        }
    } catch (error) {
        console.error("Error rendering meal plan:", error);
        container.innerHTML = `<p>❌ Error loading meal plan: ${error.message}</p>`;
    }
}




function setupMealPlanDownload() {
    const downloadBtn = document.getElementById('downloadMealPlanBtn');
    console.log("Attempting to attach listener to:", downloadBtn); 
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            console.log("CLICK IS FIRING!"); 
            const token = localStorage.getItem('auth_token');
            if (!token) {
                showPopup('Please log in to download your meal plan.');
                return;
            }
            try {
                const response = await fetch('/api/mealplan/download', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = 'mealplan.csv'; 
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    showPopup('Meal plan download started!');
                } else if (response.status === 404) {
                    const errorData = await response.json();
                    showPopup(errorData.error); 
                } else {
                    throw new Error('Failed to download meal plan.');
                }
            } catch (error) {
                console.error('Download error:', error);
                showPopup('An error occurred during download.');
            }
        });
        console.log("Download button listener attached!");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const username = localStorage.getItem("username");
    const sections = document.querySelectorAll(".section");
    if (!username) {
        window.location.href = "index.html";
        return;
    }
    const welcomeTextElement = document.getElementById("welcome-text");
    if (welcomeTextElement) {
        welcomeTextElement.textContent = `Welcome , ${username}! 🎉`;
    }
    const profileUsernameEl = document.getElementById("profile-username");
    if (profileUsernameEl) {
        profileUsernameEl.textContent = `Logged in as: ${username}`;
    }
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const sideMenu = document.getElementById("sideMenu");
    const closeBtn = document.querySelector("#sideMenu .close");
    const themeToggle = document.getElementById("themeToggle");
    hamburgerBtn?.addEventListener("click", () => sideMenu.classList.add("open"));
    closeBtn?.addEventListener("click", () => sideMenu.classList.remove("open"));
    document.querySelectorAll('.has-submenu > span').forEach(item => {
        item.addEventListener('click', () => {
            item.parentElement.classList.toggle('open');
            const submenu = item.nextElementSibling;
            if (submenu) submenu.classList.toggle('open');
        });
    });
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        if (themeToggle) themeToggle.textContent = "☀️";
    }
    themeToggle?.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const isDarkMode = document.body.classList.contains("dark-mode");
        themeToggle.textContent = isDarkMode ? "☀️" : "🌙";
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    });
    const uploadModal = document.getElementById("uploadModal");
    const uploadBtn = document.getElementById("uploadBtn");
    const closeModal = document.getElementById("closeModal");
    uploadBtn?.addEventListener("click", (event) => {
        event.preventDefault(); 
        if (uploadModal) {
            uploadModal.style.display = "block";
            sideMenu?.classList.remove("open"); 
        }
    });
    closeModal?.addEventListener("click", () => {
        if (uploadModal) uploadModal.style.display = "none";
    });
    window.addEventListener("click", (event) => {
        if (uploadModal && event.target === uploadModal) {
            uploadModal.style.display = "none";
        }
    });
    // ==================== NAVIGATION ====================
document.querySelectorAll(".footer-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            // 3. Show the target section
            targetSection.classList.add('active');
            // 4. Load data for specific sections
            if (targetId === "favourites-section") {
                 fetchAndRenderFavourites();
            } else if (targetId === "mealplan-section") {
                 fetchAndRenderMealPlan(); 
            }
        }
    });
});
    let startX = 0;
    document.addEventListener("touchstart", e => { startX = e.touches[0].clientX; });
    document.addEventListener("touchend", e => {
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        if (Math.abs(diff) > 50) {
            const active = document.querySelector(".section.active");
            const sectionsArray = Array.from(sections);
            let idx = sectionsArray.indexOf(active);
            if (diff > 0 && idx < sectionsArray.length - 1) {
                active.classList.remove("active");
                sectionsArray[idx + 1].classList.add("active");
            } else if (diff < 0 && idx > 0) {
                active.classList.remove("active");
                sectionsArray[idx - 1].classList.add("active");
            }
        }
    });
    
    // ==================== SEARCH FUNCTIONALITY ====================
    const searchIcon = document.getElementById("search-icon");
    const searchWrapper = document.getElementById("search-wrapper");
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");
    searchIcon?.addEventListener("click", () => {
        searchWrapper?.classList.toggle("active");
        if (searchWrapper?.classList.contains("active")) searchInput?.focus();
    });
    searchInput?.addEventListener("input", async () => {
        const query = searchInput.value.trim();
        if (!query) {
            if (searchResults) searchResults.innerHTML = "";
            searchWrapper?.classList.remove("has-results");
            return;
        }
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (searchResults) {
                searchResults.innerHTML = "";
                if (!data.length) {
                    searchResults.innerHTML = `<p>No recipe found</p>`;
                    searchWrapper?.classList.add("has-results");
                    return;
                }
                searchWrapper?.classList.add("has-results");
                data.forEach(r => {
                    const item = document.createElement("div");
                    item.className = "search-item";
                    item.textContent = r.name;
                    item.addEventListener("click", () => {
                        window.location.href = `recipe.html?id=${r.id}`;
                    });
                    searchResults.appendChild(item);
                });
            }
        } catch (err) {
            console.error("Search failed", err);
            searchWrapper?.classList.remove("has-results");
        }
    });
    searchInput?.addEventListener("keydown", e => {
        if (e.key === "Enter" && searchResults?.firstChild) {
            searchResults.firstChild.click();
        }
    });

const profileIcon = document.getElementById('profile-icon');
    const profileMenu = document.getElementById('profile-menu');
    const logoutLink = document.getElementById('logout');
    if (profileIcon && profileMenu) {
        profileIcon.addEventListener('click', (event) => {
            profileMenu.classList.toggle('show');
            event.stopPropagation();
        });
    }
    logoutLink?.addEventListener('click', (event) => {
        event.preventDefault();
        logoutUser(); 
    });
    window.addEventListener('click', (event) => {
        if (profileMenu && profileIcon && !profileMenu.contains(event.target) && !profileIcon.contains(event.target)) {
             if (profileMenu.classList.contains('show')) {
                 profileMenu.classList.remove('show');
             }
         }
    });

if (window.location.hash) {
        const targetId = window.location.hash.substring(1); 
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
            if (targetId === 'mealplan-section') {
                fetchAndRenderMealPlan(); 
            }
        }
    }
// ==================== RECIPE RECOMMENDATIONS ====================
    try {
        const res = await fetch("/api/recommendations");
        const recipes = await res.json();
        const container = document.getElementById("recommendations");
        if (container) {
            recipes.forEach(r => {
                const card = document.createElement("div");
                card.className = "recipe-card";
                card.innerHTML = `
                    <img src="${r.image_url}" alt="${r.name}">
                    <h3>${r.name}</h3>
                    <a href="recipe.html?id=${r.id}" class="btn">View Recipe</a>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        console.error("❌ Failed to load recommendations:", err);
    }
    const generateButton = document.getElementById('generateShoppingList'); 
    if (generateButton) {
        generateButton.addEventListener('click', fetchShoppingList);
        console.log("Generate Shopping List button event listener attached.");
    }
    console.log("DOM Content Loaded event fired.");
    setupMealPlanDownload();
});

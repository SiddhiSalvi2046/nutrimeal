// Data structure mapping categories to subcategories
const CATEGORY_MAP = {
    "Meal Type": ["Breakfast ", "Lunch ", "Dinner ", "Snacks ", "Desserts "],
    "Seasonal Recipes": ["Summer ", "Winter ", "Spring ", "Autumn "],
    "Occasional Recipes": ["Festivals ", "Parties ", "Quick Weeknight Meals "],
    "One-Pot / Easy Cooking": ["One-Pot Meals", "30-Minute Recipes ", "Slow Cooker / Instant Pot"],
    "Veg / Non-Veg": ["Vegetarian ", "Non-Vegetarian ", "Egg-based "]
};
// ==================== SPLASH ====================
window.addEventListener("load", () => {
    const splash = document.getElementById("splash");
    const app = document.getElementById("app");
    if (splash && app) {
        setTimeout(() => {
            splash.style.display = "none";
            app.classList.remove("hidden");
        }, 2000);
    }
});
function showPopup(message) {
    const popup = document.getElementById("customPopup");
    const popupMessage = document.getElementById("popupMessage");
    popupMessage.textContent = message;
    popup.style.display = "block";

    // Close button
    document.getElementById("closePopup").onclick = () => {
        popup.style.display = "none";
    };

    // Close when clicking outside
    window.onclick = (e) => {
        if (e.target === popup) {
            popup.style.display = "none";
        }
    };
}
// ==================== REUSABLE SEARCH HANDLER ====================
/**
 * Handles the live recipe search and displays results in a specific container.
 * @param {HTMLInputElement} inputElement - The search input field.
 * @param {HTMLElement | null} resultsContainer - The dropdown container for suggestions.
 * @param {HTMLElement | null} wrapperElement - The wrapper to apply 'has-results' class (optional).
 */
async function liveSearchRecipes(inputElement, resultsContainer, wrapperElement) {
    const query = inputElement.value.trim();
    if (!query) {
        if (resultsContainer) resultsContainer.innerHTML = "";
        wrapperElement?.classList.remove("has-results");
        return;
    }
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (resultsContainer) {
            resultsContainer.innerHTML = "";
            if (!data.length) {
                resultsContainer.innerHTML = `<p class="p-2 text-gray-500">No recipe found</p>`;
                wrapperElement?.classList.add("has-results");
                return;
            }
            wrapperElement?.classList.add("has-results");
            data.forEach(r => {
                const item = document.createElement("div");
                item.className = "search-item p-2 hover:bg-gray-100 cursor-pointer";
                item.textContent = r.name;
                item.addEventListener("click", () => {
                    window.location.href = `recipe.html?id=${r.id}`;
                });
                resultsContainer.appendChild(item);
            });
        }
    } catch (err) {
        console.error("Search failed", err);
        wrapperElement?.classList.remove("has-results");
    }
}
// ==================== CAPTCHA UTILITY ====================
function generateCaptcha(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out.split("").map(c => Math.random() > 0.5 ? c.toLowerCase() : c).join("");
}
// ==================== DOMContentLoaded LISTENER ====================
document.addEventListener("DOMContentLoaded", () => {
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const sideMenu = document.getElementById("sideMenu");
    const closeBtn = document.querySelector("#sideMenu .close");
    const themeToggle = document.getElementById("themeToggle");
    hamburgerBtn?.addEventListener("click", () => sideMenu.classList.add("open"));
    closeBtn?.addEventListener("click", () => sideMenu.classList.remove("open"));
    document.querySelectorAll(".has-submenu > span").forEach(item => {
        item.addEventListener("click", () => {
            const parent = item.parentElement;
            parent.classList.toggle("open");
            const submenu = parent.querySelector(".submenu");
            if (submenu) submenu.classList.toggle("open");
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
    // B. SEARCH FUNCTIONALITY (DUAL INPUT)
    const searchIcon = document.getElementById("search-icon");
    const headerSearchWrapper = document.getElementById("search-wrapper");
    const headerSearchInput = document.getElementById("search-input"); 
    const headerSearchResults = document.getElementById("search-results");
    const mainSearchInput = document.getElementById("main-search-input");
    const mainSearchButton = document.getElementById("main-search-btn");
    const mainSearchResults = document.getElementById("main-search-results"); 
    searchIcon?.addEventListener("click", () => {
        headerSearchWrapper?.classList.toggle("active");
        if (headerSearchWrapper?.classList.contains("active")) headerSearchInput?.focus();
    });

    if (headerSearchInput) {
        headerSearchInput.addEventListener("input", () => {
            liveSearchRecipes(headerSearchInput, headerSearchResults, headerSearchWrapper);
        });
        headerSearchInput.addEventListener("keydown", e => {
            if (e.key === "Enter" && headerSearchResults?.firstChild) {
                e.preventDefault();
                headerSearchResults.firstChild.click();
            }
        });
    }
    if (mainSearchInput) {
        mainSearchInput.addEventListener("input", () => {
            liveSearchRecipes(mainSearchInput, mainSearchResults, null); 
        });
        mainSearchInput.addEventListener("keydown", async e => {
            if (e.key === "Enter") {
                 e.preventDefault();
                 if (mainSearchResults?.firstChild && mainSearchResults.firstChild.classList.contains('search-item')) {
                     mainSearchResults.firstChild.click();
                 } else {
                     const query = mainSearchInput.value.trim();
                     if (query) {
                         window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
                     }
                 }
            }
        });
        mainSearchButton?.addEventListener("click", () => {
            const query = mainSearchInput.value.trim();
            if (query) {
                window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
            }
        });
    }    
    // C. CONTACT US FORM SUBMISSION (NEW LOGIC)
    const contactForm = document.getElementById('contact-form');
    const statusMessage = document.getElementById('contact-message-status');
    const submitButton = document.getElementById('contact-submit-btn');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            statusMessage.textContent = '';
            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if (res.ok) {
                    // Success path
                    statusMessage.textContent = result.message;
                    statusMessage.className = 'mt-3 text-sm text-green-600';
                    contactForm.reset();
                } else {
                    // Server returned an error (e.g., 400, 500)
                    throw new Error(result.error || `Server responded with status ${res.status}`);
                }
            } catch (error) {
                // Catch network errors or errors thrown above
                console.error("Contact Form Error:", error);
                statusMessage.textContent = `Error: ${error.message}`;
                statusMessage.className = 'mt-3 text-sm text-red-600';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Query';
            }
        });
    }
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
        }
    }
    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add("hidden");
            modal.setAttribute("aria-hidden", "true");
        }
    }
    document.querySelectorAll(".close").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-close");
            if (target) closeModal(target);
        });
    });
    document.getElementById("openSignup")?.addEventListener("click", () => {
        const profileMenu = document.getElementById("profileMenu");
        profileMenu?.classList.add("hidden");
        openModal("signupModal");
    });
    document.getElementById("openLogin")?.addEventListener("click", () => {
        const profileMenu = document.getElementById("profileMenu");
        profileMenu?.classList.add("hidden");
        openModal("loginModal");
    });
    document.getElementById("toLogin")?.addEventListener("click", () => {
        closeModal("signupModal");
        openModal("loginModal");
    });
    document.getElementById("toSignup")?.addEventListener("click", () => {
        closeModal("loginModal");
        openModal("signupModal");
    });
    function clickOutsideToClose(e) {
        if (e.target.classList.contains("modal")) {
            e.target.classList.add("hidden");
            e.target.setAttribute("aria-hidden", "true");
        }
    }
    document.getElementById("signupModal")?.addEventListener("click", clickOutsideToClose);
document.getElementById("loginModal")?.addEventListener("click", clickOutsideToClose);
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("suUsername").value.trim();
    const email = document.getElementById("suEmail").value.trim();
    const password = document.getElementById("suPassword").value;
    const enteredCaptcha = document.getElementById("suCaptcha").value.trim();
    const captchaText = document.getElementById("captchaText").textContent;

    if (password.length < 6) {
        showPopup("Password must be at least 6 characters long.");
        return;
    }


    // Case-sensitive validation
    if (enteredCaptcha !== captchaText) {
        showPopup("Captcha is incorrect. Please type exactly as shown, including uppercase/lowercase letters.");
        document.getElementById("captchaText").textContent = generateCaptcha(); 
        document.getElementById("suCaptcha").value = "";
        return; 
    }

    try {
        const res = await fetch("http://localhost:3000/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        showPopup(res.ok ? "✅ " + data.message : "❌ " + data.message);
        if (res.ok) closeModal("signupModal");
    } catch (err) {
        showPopup("⚠️ Signup failed. Please try again later.");
    }
});

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("liUsername").value.trim();
    const password = document.getElementById("liPassword").value;
    if (!username || !password) {
        showPopup("Please enter username and password.");
        return;
    }
    try {
        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            let tokenToSave = data.token || data.accessToken || data.auth_token;
            if (tokenToSave) {
                localStorage.setItem("auth_token", tokenToSave);
                localStorage.setItem("username", username);
                localStorage.setItem("user_role", data.role);
                showPopup("✅ " + data.message);
                if (data.role === 'admin') {
                    window.location.href = "admin-dashboard.html";
                } else {
                    window.location.href = "dashboard.html";
                }
            } else {
                showPopup("❌ Login successful but token was not received. Please contact support.");
                console.error("Login response missing token:", data);
            }
        } else {
            showPopup("❌ " + data.message);
        }
    } catch (err) {
        showPopup("⚠️ Login failed. Please try again later.");
    }
});
    document.getElementById("refreshCaptcha")?.addEventListener("click", () => {
        document.getElementById("captchaText").textContent = generateCaptcha();
    });
    document.getElementById("captchaText") ? document.getElementById("captchaText").textContent = generateCaptcha() : null;
    // ==================== ADDED: PROFILE ICON CLICK ====================
    const profileBtn = document.getElementById("profileBtn"); 
    const profileMenu = document.getElementById("profileMenu");
    profileBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu?.classList.toggle("hidden");
    });
    // Hide the menu if user clicks outside of it
    document.addEventListener("click", (e) => {
        if (profileMenu && !profileMenu.contains(e.target) && e.target !== profileBtn) {
            profileMenu.classList.add("hidden");
        }
    });
    // ==================== NEW: ADMIN & AUTH UI FUNCTIONS ====================
    function updateAuthUI() {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    const openSignupBtn = document.getElementById('openSignup');
    const openLoginBtn = document.getElementById('openLogin');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardLink = document.getElementById('dashboardLink');
    const adminMenuLink = document.getElementById('adminMenuLink');

    if (token) {
        openSignupBtn?.classList.add('hidden');
        openLoginBtn?.classList.add('hidden');
        logoutBtn?.classList.remove('hidden');
        dashboardLink?.classList.remove('hidden');

        if (role === 'admin') {
            adminMenuLink?.classList.remove('hidden');
        } else {
            adminMenuLink?.classList.add('hidden');
        }
    } else {
        // Ensure homepage shows correct options after logout
        openSignupBtn?.classList.remove('hidden');
        openLoginBtn?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
        dashboardLink?.classList.add('hidden');
        adminMenuLink?.classList.add('hidden');
    }
}

// Run on every page load
updateAuthUI();

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("username");
        localStorage.removeItem("user_role"); 
        updateAuthUI(); 
        showPopup("You have been logged out.");
        window.location.href = "index.html";
        
    });
    updateAuthUI();
    function updateSubcategoryOptions() {
        const categorySelect = document.getElementById('recipeCategory'); 
        const subcategorySelect = document.getElementById('recipeSubcategory'); 
        const selectedCategory = categorySelect.value;
        subcategorySelect.innerHTML = '<option value="">Select Subcategory (Optional)</option>';
        if (selectedCategory && CATEGORY_MAP[selectedCategory]) {
            const subcategories = CATEGORY_MAP[selectedCategory];
            subcategories.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.split(' ')[0]; 
                option.textContent = sub;
                subcategorySelect.appendChild(option);
            });
        }
    }
    const categorySelect = document.getElementById('recipeCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', updateSubcategoryOptions);
        updateSubcategoryOptions();
    }
});
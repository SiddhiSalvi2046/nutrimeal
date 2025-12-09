console.log("admin.js loaded successfully!"); 
alert("JS is running!");
// admin.js
const API_URL = '/api/admin'; 
//const tokenKey = 'authToken';

// --- Initial Setup & Authorization ---
// --- 1. DOM Element Variables ---
// 🛑 THESE MUST BE DECLARED AND INITIALIZED FIRST
const PENDING_COUNT_SPAN = document.getElementById('pending-count');
const DASHBOARD_RECIPES_BODY = document.getElementById('recipes-table-body');
const PENDING_TABLE_BODY = document.getElementById('pending-full-table-body');
const USERS_TABLE_BODY = document.getElementById('users-table-body');
const ALL_RECIPES_LIST = document.getElementById('all-recipes-list'); // <--- CRITICAL: Make sure this is at the top.
const QUERIES_TABLE_BODY = document.getElementById('queries-table-body');
const RECIPES_BODY = document.getElementById('pending-full-table-body'); 
const ALL_RECIPES_COUNT = document.getElementById('all-count');
const USERS_COUNT = document.getElementById('users-count');
const QUERIES_COUNT = document.getElementById('queries-count');
const token = localStorage.getItem('authToken'); 
const VIEWS = {
        'dashboard-link': 'dashboard-view',
        'pending-link': 'pending-view',
        'all-recipes-link': 'all-recipes-view', // <-- Target View ID
        'users-link': 'users-view',             // <-- Target View ID
        'queries-link': 'queries-view',
        'dashboard-review-link': 'pending-view' // The button in the alert card
    };



function getAdminToken() {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
        alert('Access Denied. You must be logged in as an Admin.');
        window.location.href = '/login.html'; // Adjust to your actual login page name
        return null;
    }
    return token;
}

// admin.js (Add this function to the file)

/**
 * Sends a PUT request to the server to update a recipe's status.
 * @param {number} recipeId - The ID of the recipe to update.
 * @param {string} status - 'approved' or 'rejected'.
 */
async function updateRecipeStatus(recipeId, status) {
    if (!confirm(`Are you sure you want to ${status} recipe ${recipeId}?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/recipes/status/${recipeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Failed to update status: ${res.statusText}`);
        }

        alert(`Recipe ${recipeId} successfully ${status}.`);
        
        // Refresh the pending list after a successful action
        fetchPendingRecipes(); 
        fetchAllRecipes();

    } catch (error) {
        console.error(`Error updating recipe status to ${status}:`, error);
        alert('Failed to update recipe status. See console for details.');
    }
}
window.updateRecipeStatus = updateRecipeStatus;


/*function getAdminToken() {
    // 🛑 CRITICAL: Ensure the key used here matches the key used in app.js ('auth_token')
    const token = localStorage.getItem('authToken'); 
    if (!token) {
        console.error("Admin token not found. Redirecting to login.");
        window.location.href = 'index.html';
    }
    return token;
}*/

// --- View Switching Logic ---
// -----------------------------------------------------------
// The core function to switch visibility and trigger fetching
// -----------------------------------------------------------

// admin.js (Inside the DOMContentLoaded listener or defined globally, if preferred)

function handleViewSwitch(targetViewId, clickedLink) {
    
    // A. HIDE ALL VIEWS FIRST
    // 🛑 CRITICAL LINE: Ensure 'content-section' is the class applied to ALL main view DIVs/SECTIONS.
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // B. SHOW THE TARGET VIEW
    const targetView = document.getElementById(targetViewId);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // C. HANDLE ACTIVE CLASS STYLING (The blue selection)
    const navLinks = document.querySelectorAll('.sidebar-link');
    navLinks.forEach(l => l.classList.remove('active'));
    if (clickedLink) {
         clickedLink.classList.add('active'); 
    }

    // D. TRIGGER DATA FETCHING based on the view
    if (targetViewId === 'dashboard-view') {
        // Dashboard needs to fetch the quick stats
        fetchPendingRecipes(); 
    } else if (targetViewId === 'pending-view') {
        // Pending view needs to fetch the full pending list
        fetchPendingRecipes(PENDING_TABLE_BODY); 
    } else if (targetViewId === 'all-recipes-view') {
        fetchAllRecipes();
    } else if (targetViewId === 'users-view') {
        fetchAllUsers();
    }  else if (targetViewId === 'queries-view') {
    fetchQueries(); // 🛑 MAKE SURE THIS IS PRESENT AND UNCOMMENTED
} 
    // ... add logic for queries-view when implemented
}
async function fetchAllUsers() {
    const token = getAdminToken();
    if (!token) return;
    USERS_TABLE_BODY.innerHTML = '<tr><td colspan="5" class="loading-message">Loading users...</td></tr>';

    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const users = await res.json();
        USERS_COUNT.textContent = users.length;

        USERS_TABLE_BODY.innerHTML = ''; // Clear loading row

        users.forEach(user => {
            const row = USERS_TABLE_BODY.insertRow();
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="p-1 rounded-md text-xs ${user.role === 'admin' ? 'bg-red-200' : 'bg-green-200'}">${user.role}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td><button class="btn btn-reject action-btn" data-id="${user.id}" data-action="block">Block</button></td>
            `;
        });

    } catch (error) {
        console.error('Fetch Users Error:', error);
        USERS_TABLE_BODY.innerHTML = '<tr><td colspan="5">Failed to load user list.</td></tr>';
    }
}


async function blockUser(userId, rowElement) {
    const token = getAdminToken();
    if (!token) return;

    if (!confirm(`WARNING: Are you sure you want to PERMANENTLY block and delete User ID ${userId}? This is irreversible.`)) {
        return;
    }
    
    // 1. Define the API endpoint for user deletion
    const apiUrl = `/api/admin/users/${userId}`; // e.g., /api/admin/users/123
    console.log(`Attempting to send DELETE request to: ${apiUrl}`); 

    try {
        const res = await fetch(apiUrl, {
            method: 'DELETE', // Use DELETE method for deletion
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Failed to block user: ${res.statusText}`);
        }

        // 2. Success: Remove the row from the dashboard
        rowElement.remove();
        alert(`User ID ${userId} has been permanently blocked (deleted).`);

        // 3. Optional: Refresh dashboard counts if needed
        fetchPendingRecipes(); 

    } catch (error) {
        console.error(`Error blocking user ${userId}:`, error);
        alert(`Failed to block user ${userId}. Error: ${error.message}`);
    }
}


// admin.js (Cont.)
async function fetchAllRecipes() {
    const token = getAdminToken();
    if (!token) return;
    ALL_RECIPES_LIST.innerHTML = '<p class="loading-message">Loading all recipes...</p>';

    try {
        // We use the public route, or create a new admin route to get ALL statuses
        const res = await fetch('/api/recipes/public', {
             headers: { 'Authorization': `Bearer ${token}` } // Still send token for admin context
        });
        
        const recipes = await res.json();
        ALL_RECIPES_COUNT.textContent = recipes.length;

        ALL_RECIPES_LIST.innerHTML = ''; // Clear loading message
        if (recipes.length === 0) {
            ALL_RECIPES_LIST.innerHTML = '<p class="loading-message">No recipes found.</p>';
            return;
        }
        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card shadow-lg p-4 bg-white rounded-lg';
            card.id = `all-recipe-card-${recipe.id}`; // Add ID for easier DOM removal
            card.innerHTML = `
                <img src="${recipe.image_url || 'https://via.placeholder.com/150'}" alt="${recipe.name}" class="w-full h-32 object-cover rounded mb-3">

                <h4 class="font-bold">${recipe.name}</h4>
                <p style="font-size: 1rem; color: var(--secondary-color);">${recipe.category}</p>
        
                <div style="margin-top: 10px;">
                    
                    <button class="btn btn-reject action-btn" data-id="${recipe.id}" data-action="delete">Delete</button>
                </div>
            `;
            ALL_RECIPES_LIST.appendChild(card);
            
        });

    } catch (error) {
        console.error('Fetch All Recipes Error:', error);
        ALL_RECIPES_LIST.innerHTML = '<p>Failed to load all recipes.</p>';
    }
}

async function fetchPendingRecipes() {
    const token = getAdminToken();
    if (!token) return;
    // ... (Error handling and loading state omitted for brevity)
    if (!RECIPES_BODY) {
        console.error("RECIPES_BODY element not found.");
        return;
    }

    RECIPES_BODY.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">Loading pending recipes...</td></tr>';


    try {
        const res = await fetch(`/api/admin/recipes?status=pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Server error: ${res.status}`);
        }
        const recipes = await res.json();
        RECIPES_BODY.innerHTML = '';
        if (!Array.isArray(recipes) || !recipes.length) {
            RECIPES_BODY.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No recipes currently pending.</td></tr>';
            return;
        }
        
        PENDING_COUNT_SPAN.textContent = recipes.length;
        PENDING_TABLE_BODY.innerHTML = ''; // Clear existing list

        if (recipes.length === 0) {
            PENDING_TABLE_BODY.innerHTML = `<tr><td colspan="4">No pending recipes.</td></tr>`;
            return;
        }

        recipes.forEach(recipe => {
    const userId = recipe.submitted_by_user_id || 'Admin/System'; // Handle NULL case
    
    const row = RECIPES_BODY.insertRow();
    row.innerHTML = `
        <td class="py-3 px-6 text-left">${recipe.id}</td>
                <td class="py-3 px-6 text-left">${recipe.name}</td>
                <td class="py-3 px-6 text-left">${recipe.category}</td>
                <td class="py-3 px-6 text-center">${recipe.author || 'User'}</td>
        <td>
            <button class="btn btn-approve" onclick="updateRecipeStatus(${recipe.id}, 'approved')">Approve</button>
            <button class="btn btn-reject" onclick="updateRecipeStatus(${recipe.id}, 'rejected')">Reject</button>
            <a href="#" class="btn btn-view">View</a> 
        </td>
    `;
});

    } catch (error) {
        console.error('Fetch Pending Error:', error);
         RECIPES_BODY.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-600">Error: ${error.message}</td></tr>`;
    }
}

async function fetchQueries() {
    const token = getAdminToken();
    if (!token) return;
    
    // 🛑 Ensure this ID is correct for your Queries Table body
    if (!QUERIES_TABLE_BODY) {
        console.error("QUERIES_TABLE_BODY element not found.");
        return;
    }

    QUERIES_TABLE_BODY.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">Loading queries...</td></tr>';

    try {
        const res = await fetch('/api/admin/queries', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 🛑 CRITICAL FIX: Handle non-OK status (like 403 Forbidden)
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Server error fetching queries: ${res.status}`);
        }

        const queries = await res.json(); // Data should now be the array of queries
        QUERIES_COUNT.textContent = queries.length;

        QUERIES_TABLE_BODY.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4 text-gray-500">Loading queries...</td>
        </tr>
    `; // Clear loading row

        if (!queries.length) {
            QUERIES_TABLE_BODY.innerHTML = '<tr><td colspan="6" class="p-4 text-center">No user queries found.</td></tr>';
            return;
        }

        queries.forEach((query, index) => {
            const row = QUERIES_TABLE_BODY.insertRow();
            // Alternate row background for better readability
            row.classList.add(index % 2 === 0 ? 'bg-white' : 'bg-gray-50', 'hover:bg-gray-100');
            
            const statusClass = query.status === 'new' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800';
            const date = new Date(query.created_at).toLocaleDateString();

            // 🛑 CRITICAL JS FIX: Use PX-6 for padding, and ensure all 6 columns are present
            row.innerHTML = `
                <td class="py-3 px-6 text-left whitespace-nowrap">${query.id}</td>
                <td class="py-3 px-6 text-left">${query.name}</td>
                <td class="py-3 px-6 text-left">${query.email}</td>
                <td class="py-3 px-6 text-left">${query.message.substring(0, 75)}...</td>
                <td class="py-3 px-6 text-center">
                    <span class="py-1 px-3 rounded-full text-xs font-semibold ${statusClass}">
                        ${query.status.toUpperCase()}
                    </span>
                </td>
                <td class="py-3 px-6 text-center">${date}</td>
                <td class="py-3 px-6 text-center">
                <button class="btn btn-approve action-btn" data-id="${query.id}" data-action="resolve">Resolve</button>
                </td>
            `;
        });

    } catch (error) {
        console.error('Fetch Queries Error:', error.message);
        QUERIES_TABLE_BODY.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-600">Error: ${error.message}. Please check token.</td></tr>`;
    }
}

async function resolveQuery(queryId, rowElement) {
    const token = getAdminToken();
    if (!token) return;

    if (!confirm(`Are you sure you want to resolve and delete Query ID ${queryId}?`)) {
        return;
    }
    
    // API endpoint for query deletion (using the route we planned earlier)
    const apiUrl = `/api/admin/queries/${queryId}`; 

    try {
        const res = await fetch(apiUrl, {
            method: 'DELETE', // DELETE method
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        // Use the improved error handling (for the 404/non-JSON case)
        if (!res.ok) {
            const contentType = res.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Failed to resolve query: ${res.statusText}`);
            } else {
                throw new Error(`Server responded with ${res.status} ${res.statusText}. Check your backend DELETE route for queries.`);
            }
        }

        // Success: Remove the row from the dashboard
        rowElement.remove();
        alert(`Query ID ${queryId} has been marked as resolved (deleted).`);
        
        // Optional: Update the dashboard count
        fetchPendingRecipes(); 

    } catch (error) {
        console.error(`Error resolving query ${queryId}:`, error);
        alert(`Failed to resolve query ${queryId}. Error: ${error.message}`);
    }
}


async function deleteRecipe(recipeId, cardElement) {
    const token = getAdminToken();
    if (!token) return;

    if (!confirm(`Are you sure you want to PERMANENTLY delete Recipe ID ${recipeId}? This action is irreversible.`)) {
        return;
    }
    
    
    const apiUrl = `/api/admin/recipes/${recipeId}`; 

    try {
        const res = await fetch(apiUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            // Using your improved error checking logic
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Failed to delete recipe: ${res.statusText}`);
            } else {
                throw new Error(`Server responded with ${res.status} ${res.statusText}. Check your backend DELETE route.`);
            }
        }

        // Success: Remove the card from the dashboard
        cardElement.remove();
        alert(`Recipe ID ${recipeId} has been successfully deleted.`);
        
        // Refresh dashboard counts
        fetchPendingRecipes(); 

    } catch (error) {
        console.error(`Error deleting recipe ${recipeId}:`, error);
        alert(`Failed to delete recipe ${recipeId}. Error: ${error.message}`);
    }
}


        


if (!token) {
    // Optionally redirect to login or show a critical error if no token is found
    console.error("Authentication token not found. Please log in.");
    // alert("Session expired. Please log in."); 
    // window.location.href = 'login.html'; // Example redirect
}


// Get the badge element (assuming the ID above)
const pendingCountBadge = document.getElementById("pending-count-badge");

async function updatePendingCount() {
    if (!token) {
        pendingCountBadge.textContent = 'Auth Error';
        return;
    }

    try {
        // Assume you have an API endpoint just for the count
        const res = await fetch('/api/admin/recipes/pending/count', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            throw new Error(`Failed to fetch count: ${res.statusText}`);
        }

        // Assuming the response is a simple JSON object like { count: 5 }
        const data = await res.json();
        const count = data.count || 0; 
        
        // 💥 FIX 2: Update the badge text
        pendingCountBadge.textContent = count > 0 ? `(${count})` : ''; 
        
    } catch (error) {
        console.error("Error fetching pending count:", error);
        pendingCountBadge.textContent = 'Err';
    }
}



document.addEventListener('DOMContentLoaded', () => {
    
    const navLinks = document.querySelectorAll('.sidebar-link'); 

    // Attach Click Listeners
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = VIEWS[e.currentTarget.id];
            
            if (targetId) {
                // Use the centralized handler
                handleViewSwitch(targetId, e.currentTarget); 
            }
        });
    });


    
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
                statusMessage.textContent = result.message;
                statusMessage.className = 'mt-3 text-sm text-green-600';
                contactForm.reset();
            } else {
                throw new Error(result.error || 'Unknown error submitting form.');
            }
        } catch (error) {
            console.error("Contact Form Error:", error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.className = 'mt-3 text-sm text-red-600';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Query';
        }
    });
}
    // Initial Load: Show dashboard
    const initialLink = document.getElementById('dashboard-link');
    if (initialLink) {
        // This runs the first time, making the dashboard active and fetching its content.
        handleViewSwitch(VIEWS['dashboard-link'], initialLink); 
    }

});


// --- Universal Action Button Listener (For Block, Delete, Resolve, etc.) ---
document.body.addEventListener('click', (e) => {
    // Check if the clicked element or its ancestor is a button with class 'action-btn'
    const btn = e.target.closest('.action-btn');
    
    if (btn) {
        const itemId = parseInt(btn.dataset.id);
        const action = btn.dataset.action;
        
        // Find the closest table row or card element to remove on success
        const rowOrCard = btn.closest('tr') || btn.closest('.recipe-card'); 

        if (itemId && action && rowOrCard) {
            
            if (action === 'block') {
                // Call the specific block function for users
                blockUser(itemId, rowOrCard);
            } 
            else if (action === 'resolve') {
                resolveQuery(itemId, rowOrCard);
            }
            else if (action === 'delete') {
                deleteRecipe(itemId, rowOrCard);
            } 
            // We will handle 'view-recipe' separately in Part 3
            else if (action === 'view-recipe') {
                handleViewRecipeDetails(itemId);
            }
            // Add other actions (delete, resolve) here later!
            
            // For pending recipes, we already have onclick in the fetchPendingRecipes function.
            // If you change the pending buttons to use action-btn, use this block:
            /*
            else if (action === 'approve') {
                updateRecipeStatus(itemId, 'approved');
            } else if (action === 'reject') {
                updateRecipeStatus(itemId, 'rejected');
            }
            */
        }
    }
});
document.addEventListener("DOMContentLoaded", () => {
    // Load the pending count immediately when the dashboard is ready
    updatePendingCount(); 

    // Re-add the click handler for the navigation link
    document.getElementById('pending-recipes-nav-link').addEventListener('click', (e) => {
        e.preventDefault(); // Stop the link from navigating if it's an <a> tag
        
        // 1. Show the correct section 
        // (You need to re-add your logic here to show #pending-view and hide others)
        
        // 2. Fetch and render the full table
        fetchPendingRecipes(); 
    });
});
// LOGOUT FUNCTIONALITY
document.getElementById("logout-btn").addEventListener("click", (e) => {
  e.preventDefault();

  // Optional: clear any stored admin data
  localStorage.removeItem("auth_token");
  localStorage.removeItem("adminLoggedIn");
  sessionStorage.removeItem("adminSession");
  window.location.href = "index.html";
});

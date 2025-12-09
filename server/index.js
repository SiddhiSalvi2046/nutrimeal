// server/index.js
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import multer from 'multer';
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticate, isAdmin } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../client")));
app.use("/images", express.static("C:/Users/SIDDHI SALVI/nutri-meal/IMAGES"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test DB connection
(async () => {
  try {
    const [rows] = await db.query("SELECT 1");
    console.log("✅ Connected to MySQL");
  } catch (err) {
    console.error("❌ MySQL connection error:", err.message);
  }
})();


// ======================
// Recipe Submission API (CLEANED)
// ======================
/**
 * POST /api/recipes/upload
 * Protects route with 'authenticate' middleware and uses req.user.id.
 */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/recipes/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.post('/api/recipes/upload', authenticate, upload.single('image'), async (req, res) => {
    const user_id = req.user.id;

    const { name, description, serving, category, subcategory, ingredients, instructions, cuisine, nutrition } = req.body;

    if (!name || !ingredients || !instructions || !category || !serving) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    const ingredientsJson = JSON.stringify(ingredients);
    const stepsJson = JSON.stringify(instructions);

    // Use uploaded file path
    const imagePath = req.file ? `/images/recipes/${req.file.filename}` : null;

    const insertQuery = `
        INSERT INTO recipes 
        (name, description, servings, category, subcategory, 
         ingredients, steps, cuisine, nutrition, image_url, submitted_by_user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const values = [
        name,
        description || null,
        serving,
        category,
        subcategory || null,
        ingredientsJson,
        stepsJson,
        cuisine || null,
        nutrition || null,
        imagePath, // <-- Correctly set
        user_id
    ];

    try {
        const [result] = await db.query(insertQuery, values);
        res.status(201).json({ message: 'Recipe uploaded', recipe_id: result.insertId });
    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: 'Database insertion failed.' });
    }
});

// ======================
// Recipe Search
// ======================
app.get("/recipe/:dish", async (req, res) => {
  const { dish } = req.params;

  try {
    const [results] = await db.query("SELECT * FROM recipes WHERE name = ?", [dish]);

    if (results.length > 0) {
      const recipe = results[0];
      recipe.ingredients = JSON.parse(recipe.ingredients || "[]");
      recipe.steps = JSON.parse(recipe.steps || "[]");
      return res.json(recipe);
    }

    // If not found, generate with AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Give me a recipe for ${dish} in JSON format with fields: name, ingredients (array), and steps (array).`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let recipe;
    try {
      const match = text.match(/```json([\s\S]*?)```/);
      const jsonString = match ? match[1].trim() : text.trim();
      recipe = JSON.parse(jsonString);
    } catch (e) {
      console.error("❌ JSON parse failed, raw response:", text);
      return res.status(500).json({ error: "AI response was not valid JSON" });
    }

    // Save to DB
    await db.query(
      "INSERT INTO recipes (name, ingredients, steps) VALUES (?, ?, ?)",
      [recipe.name, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.steps)]
    );

    return res.json(recipe);

  } catch (err) {
    console.error("❌ Recipe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/recommendations", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT id, name, image_url FROM recipes ORDER BY RAND() LIMIT 5"
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});



// ======================
// Recipe browsing APIs
// ======================

// Get all recipes by cuisine
app.get("/api/cuisine/:cuisine", async (req, res) => {
  try {
    const { cuisine } = req.params;
    const [rows] = await db.query("SELECT * FROM recipes WHERE cuisine = ?", [cuisine]);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching cuisine recipes:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get recipes by category and/or subcategory
app.get("/api/recipes", async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    let rows;

    if (category && subcategory) {
      [rows] = await db.query(
        "SELECT * FROM recipes WHERE LOWER(category) = LOWER(?) AND LOWER(subcategory) = LOWER(?)",
        [category, subcategory]
      );
    } else if (category) {
      [rows] = await db.query(
        "SELECT * FROM recipes WHERE LOWER(category) = LOWER(?)",
        [category]
      );
    } else {
      [rows] = await db.query("SELECT * FROM recipes");
    }

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching recipes:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});



// Get single recipe details
app.get("/api/recipe/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query("SELECT * FROM recipes WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Recipe not found" });

    const recipe = rows[0];
    // Parse JSON fields
    try { recipe.ingredients = JSON.parse(recipe.ingredients); } catch {}
    try { recipe.steps = JSON.parse(recipe.steps); } catch {}
    try { recipe.nutrition = JSON.parse(recipe.nutrition); } catch {}

    res.json(recipe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
});

// ======================
// Authentication
// ======================
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
      [username, email, hashedPassword]
    );
    res.json({ message: "Signup successful!" });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: "All fields are required" });

    try {
        const [users] = await db.query("SELECT id, username, password, role FROM users WHERE username = ?", [username]);
        if (users.length === 0) return res.status(401).json({ error: "Invalid username or password" });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid username or password" });

        // ==========================================
        // 🔑 FIX: GENERATE AND RETURN THE JWT TOKEN
        // ==========================================
        const payload = { 
            id: user.id, 
            username: user.username,
            role: user.role || 'user' 
        };
        // Use process.env.JWT_SECRET from your .env file
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24d' }); 
        
        // 🔑 SEND THE TOKEN IN THE RESPONSE BODY
        // The client-side (app.js) is expecting 'token' in the response data.
        return res.json({ 
            message: `Welcome , ${user.username}!`,
            token: token, // <--- THIS IS THE CRITICAL ADDITION
            username: user.username,
            role: user.role // (Optional but useful)
        });

    } catch (err) {
        console.error("❌ Login error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});



// ======================
// Favourites
// ======================
app.post('/api/favourites', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { recipe_id } = req.body;
    await db.query('INSERT INTO favourites (user_id, recipe_id) VALUES (?, ?)', [payload.id, recipe_id]);
    res.json({ message: 'Added to favourites' });
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
});


app.get('/api/favourites', authenticate , async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT r.* 
       FROM favourites f 
       JOIN recipes r ON f.recipe_id = r.id 
       WHERE f.user_id = ?`, 
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch favourites" });
  }
});

app.delete('/api/favourites/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const recipeId = req.params.id;

  try {
    await db.query("DELETE FROM favourites WHERE user_id=? AND recipe_id=?", [userId, recipeId]);
    res.json({ message: "Removed from favourites" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove favourite" });
  }
});

// ✅ Add Recipe to Meal Plan
// POST route to add a meal
app.post('/api/mealplan', authenticate, async (req, res) => {
    const userId = req.user.id;
    const { recipe_id, day_of_week, meal_type } = req.body;
    try {
        await db.query(
            'INSERT INTO meal_planner (user_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE recipe_id = VALUES(recipe_id)',
            [userId, recipe_id, day_of_week, meal_type]
        );
        res.status(201).json({ message: 'Meal saved successfully.' });
    } catch (err) {
        console.error('Error saving meal:', err);
        res.status(500).json({ error: 'Failed to save meal plan.' });
    }
});

// GET route to fetch the entire meal plan
app.get('/api/mealplan', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        // Join meal_planner with recipes to get all details
        const [meals] = await db.query(
            `SELECT 
                mp.id AS meal_plan_entry_id,  -- 🔑 KEY FIX: Rename the unique meal_planner ID
                mp.day_of_week, 
                mp.meal_type,
                r.id AS recipe_id, 
                r.name, 
                r.image_url 
            FROM meal_planner mp 
            JOIN recipes r ON mp.recipe_id = r.id 
            WHERE mp.user_id = ?`,
            [userId]
        );
        res.json(meals); // Frontend will structure this data by day/type
    } catch (err) {
        console.error('Error fetching meal plan:', err);
        res.status(500).json({ error: 'Failed to fetch meal plan.' });
    }
});
app.delete('/api/mealplan/:id', authenticate, async (req, res) => {
    const userId = req.user.id;
    const mealPlanEntryId = req.params.id; // Correctly grabs the '31'

    try {
        const [result] = await db.query(
            // The now-correct SQL query with placeholders
            'DELETE FROM meal_planner WHERE id = ? AND user_id = ?',
            [mealPlanEntryId, userId] 
        );

        if (result.affectedRows === 0) {
            // This is the only place your code sends a 404/403
            return res.status(404).json({ error: 'Meal plan entry not found or access denied.' });
        }

        res.json({ message: 'Meal successfully removed from the plan.' });
    } catch (err) {
        console.error('Error removing meal:', err);
        res.status(500).json({ error: 'Failed to remove meal plan entry.' });
    }
});









// Search recipes by name (for search bar + auto-suggestions)
app.get("/api/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const [rows] = await db.query(
      "SELECT id, name FROM recipes WHERE name LIKE ? LIMIT 10",
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Search error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});


// ======================
// Admin Dashboard APIs (MODIFIED/ADDED)
// ======================

// 1. GET: Fetch all recipes (or filter by status) for admin review
// ======================
// Admin Dashboard APIs (MODIFIED/ADDED)
// ======================

// 1. GET: Fetch all recipes (or filter by status) for admin review
app.get("/api/admin/recipes", authenticate, isAdmin, async (req, res) => {
    // 🛑 The logic below MUST be inside the handler function!
    const { status } = req.query; // Get status from query params (e.g., ?status=pending)
    
    let query = `
        SELECT 
            id, 
            name, 
            category, 
            subcategory, 
            submitted_by_user_id,  
            created_at,
            status 
        FROM recipes
    `;
    const params = [];

    // Filter by status if provided
    if (status) {
        // We ensure we only allow valid statuses to prevent SQL injection or bad queries
        if (['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
            query += " WHERE status = ?";
            params.push(status);
        } else {
             // Optional: Return an error for an invalid status
             return res.status(400).json({ error: "Invalid recipe status filter." });
        }
    }

    query += " ORDER BY created_at DESC"; // Always sort by newest first

    try {
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("❌ Admin fetch recipes error:", err.message);
        res.status(500).json({ error: "Failed to fetch recipes" });
    }
});


// 2. GET: Fetch a single recipe (including pending ones) by ID for review
app.get("/api/admin/recipe/:id", authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Admin can view any recipe, regardless of approval status
        const [rows] = await db.query("SELECT * FROM recipes WHERE id = ?", [id]); 
        if (rows.length === 0) return res.status(404).json({ error: "Recipe not found" });

        const recipe = rows[0];
        // Parse JSON fields
        try { recipe.ingredients = JSON.parse(recipe.ingredients); } catch (e) {console.error("Error parsing ingredients:", e)}
        try { recipe.steps = JSON.parse(recipe.steps); } catch (e) {console.error("Error parsing steps:", e)}
        try { recipe.nutrition = JSON.parse(recipe.nutrition); } catch (e) {console.error("Error parsing nutrition:", e)}

        res.json(recipe);
    } catch (err) {
        console.error("❌ Admin fetch single recipe error:", err.message);
        res.status(500).json({ error: "Failed to fetch recipe" });
    }
});

// 3. PUT: Update Recipe Status (Approve/Reject)
app.put("/api/admin/recipes/status/:id", authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Expects 'approved' or 'rejected'

    if (!status || (status !== 'approved' && status !== 'rejected')) {
        return res.status(400).json({ error: "Invalid status provided. Must be 'approved' or 'rejected'." });
    }

    try {
        const [result] = await db.query(
            "UPDATE recipes SET status = ? WHERE id = ?",
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Recipe not found." });
        }
        res.json({ message: `Recipe successfully set to ${status}.` });

    } catch (err) {
        console.error("❌ Admin update status error:", err.message);
        res.status(500).json({ error: "Server error during status update." });
    }
});

app.get('/api/recipes/public', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM recipes WHERE status = 'approved' ORDER BY created_at DESC");
        rows.forEach(r => {
            try { r.ingredients = JSON.parse(r.ingredients); } catch {}
            try { r.steps = JSON.parse(r.steps); } catch {}
        });
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch public recipes" });
    }
});


// 4. DELETE: Delete a recipe
app.delete("/api/admin/recipes/:id", authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM recipes WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Recipe not found." });
        }
        res.json({ message: "Recipe deleted successfully by Admin." });

    } catch (err) {
        console.error("❌ Admin delete recipe error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// 5. GET: Fetch all users for admin management
app.get("/api/admin/users", authenticate, isAdmin, async (req, res) => {
    try {
        // Only fetch essential user data (exclude password hash!)
        const [rows] = await db.query(
            "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error("❌ Admin fetch users error:", err.message);
        res.status(500).json({ error: "Failed to fetch user list" });
    }
});

// 6. GET: Fetch all queries for admin review
app.get("/api/admin/queries", authenticate, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, email, message, status, created_at FROM queries ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error("❌ Admin fetch queries error:", err.message);
        res.status(500).json({ error: "Failed to fetch user queries" });
    }
});
// 7. DELETE: Delete a user (Block function)
app.delete("/api/admin/users/:id", authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;

    // Safety check: Don't let an admin delete themselves or another admin easily
    // This is optional but highly recommended!
    if (req.user.id === parseInt(id)) {
        return res.status(403).json({ error: "You cannot delete your own admin account." });
    }

    try {
        const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found or already deleted." });
        }
        // Send a successful 200/204 response with a JSON message
        res.json({ message: "User blocked (deleted) successfully." }); 

    } catch (err) {
        console.error("❌ Admin delete user error:", err.message);
        res.status(500).json({ error: "Server error during user deletion." });
    }
});

// 8. DELETE: Delete a query (Resolve function)
app.delete("/api/admin/queries/:id", authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM queries WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Query not found or already resolved." });
        }
        res.json({ message: "Query resolved (deleted) successfully." });
    } catch (err) {
        console.error("❌ Admin delete query error:", err.message);
        res.status(500).json({ error: "Server error during query deletion." });
    }
});

/**
 * Deletes a query record from the database (marking it as resolved).
 * @param {number} queryId - The ID of the query to resolve/delete.
 * @param {HTMLElement} rowElement - The table row element to remove on success.
 */
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

// ======================
// Contact Form Submission
// ======================
app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required." });
    }

    const insertQuery = `
        INSERT INTO queries (name, email, message)
        VALUES (?, ?, ?)
    `;
    const values = [name, email, message];

    try {
        await db.query(insertQuery, values);
        res.status(201).json({ message: "Your query has been submitted successfully. We will get back to you soon!" });
    } catch (err) {
        console.error("❌ Contact form submission error:", err.message);
        res.status(500).json({ error: "Failed to submit query due to a server error." });
    }
});




// Helper function placeholder: Replace with your actual JWT verification logic
// This should return the user ID or null if the token is invalid/missing
const getUserIdFromToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    
    try {
        // Replace 'YOUR_JWT_SECRET' with your actual secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        
        // 🔑 THE FIX IS HERE: Change '.id' if your token payload uses a different key
        return decoded.id; // <--- The user ID is likely stored under the 'id' property
        
    } catch (err) {
        // Token is invalid or expired
        return null;
    }
};

// Route 1: GET Recipe Stats
app.get('/api/recipe/:id/stats', async (req, res) => {
    const recipeId = req.params.id;
    const userId = getUserIdFromToken(req); 
    
    try {
        // NOTE: Replace 'db.query' with your actual database function (e.g., pool.execute)

        // a) Fetch Counts (Likes/Dislikes)
        const [counts] = await db.query(
            `SELECT 
                SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) AS likeCount,
                SUM(CASE WHEN type = 'dislike' THEN 1 ELSE 0 END) AS dislikeCount
            FROM likes_dislikes WHERE recipe_id = ?`,
            [recipeId]
        );
        
        let userAction = null;
        let isFavourite = false;

        if (userId) {
            // b) Check User's Action
            const [userActionRow] = await db.query(
                `SELECT type FROM likes_dislikes WHERE user_id = ? AND recipe_id = ?`,
                [userId, recipeId]
            );
            userAction = userActionRow.length > 0 ? userActionRow[0].type : null;

            // c) Check User's Favourites
            const [favRow] = await db.query(
                `SELECT 1 FROM favourites WHERE user_id = ? AND recipe_id = ?`,
                [userId, recipeId]
            );
            isFavourite = favRow.length > 0;
        }

        // d) Fetch Comments
        const [comments] = await db.query(
            `SELECT c.content, c.created_at, u.username 
             FROM comments c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.recipe_id = ? ORDER BY c.created_at DESC`,
            [recipeId]
        );

        res.json({
            likeCount: counts[0].likeCount || 0,
            dislikeCount: counts[0].dislikeCount || 0,
            userAction,
            isFavourite,
            comments 
        });

    } catch (error) {
        console.error('Error fetching recipe stats:', error);
        res.status(500).json({ error: 'Internal Server Error while fetching stats.' });
    }
});
// index.js (Node.js/Express Backend)

// Middleware to ensure user is authenticated
const authenticateUser = (req, res, next) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    req.userId = userId; // Attach userId to the request for controller use
    next();
};

// Route 2: POST/DELETE Toggle Like/Dislike
app.post('/api/recipe/:id/toggle-like', authenticateUser, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.userId;
    const { type } = req.body; // 'like' or 'dislike'
    
    if (type !== 'like' && type !== 'dislike') {
        return res.status(400).json({ error: 'Invalid action type.' });
    }

    try {
        // Start a transaction for safety (optional but recommended)
        // Check for existing action
        const [existingAction] = await db.query(
            `SELECT id, type FROM likes_dislikes WHERE user_id = ? AND recipe_id = ?`,
            [userId, recipeId]
        );
        
        // Case 1: Existing action is found
        if (existingAction.length > 0) {
            const existingType = existingAction[0].type;
            
            if (existingType === type) {
                // User clicked the SAME button again (e.g., Like then Like)
                // The frontend should have sent a DELETE request, but we handle the case here.
                return res.status(409).json({ error: `${type} already recorded.` }); 
            } else {
                // User is changing action (e.g., Like to Dislike)
                await db.query(
                    `UPDATE likes_dislikes SET type = ? WHERE user_id = ? AND recipe_id = ?`,
                    [type, userId, recipeId]
                );
                return res.json({ message: `Action successfully changed to ${type}.` });
            }
        } 
        
        // Case 2: No existing action. Insert the new one.
        await db.query(
            `INSERT INTO likes_dislikes (user_id, recipe_id, type) VALUES (?, ?, ?)`,
            [userId, recipeId, type]
        );
        return res.status(201).json({ message: `${type} recorded.` });

    } catch (error) {
        console.error('Error toggling like action:', error);
        res.status(500).json({ error: 'Internal Server Error during action.' });
    }
});


// Handle the DELETE request (user un-liking/un-disliking)
app.delete('/api/recipe/:id/toggle-like', authenticateUser, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.userId;
    const { type } = req.body; // 'like' or 'dislike' (The type the user wants to remove)
    
    try {
        const [result] = await db.query(
            `DELETE FROM likes_dislikes WHERE user_id = ? AND recipe_id = ? AND type = ?`,
            [userId, recipeId, type]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No existing action to remove.' });
        }
        
        return res.json({ message: 'Action successfully removed.' });

    } catch (error) {
        console.error('Error removing like action:', error);
        res.status(500).json({ error: 'Internal Server Error during removal.' });
    }
});

app.post('/api/recipe/:id/comment', authenticateUser, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.userId; // Set by authenticateUser middleware
    const { content } = req.body; // The comment text
    
    // Basic validation
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    try {
        // Insert the comment into the database
        const [result] = await db.query(
            `INSERT INTO comments (recipe_id, user_id, content) VALUES (?, ?, ?)`,
            [recipeId, userId, content.trim()]
        );
        
        // Respond with success
        res.status(201).json({ 
            message: 'Comment posted successfully.',
            comment_id: result.insertId 
        });

    } catch (error) {
        console.error('❌ Error posting comment:', error);
        // If the table doesn't exist, this will return a 500 error, which is caught by the frontend.
        res.status(500).json({ error: 'Internal Server Error while posting comment.' });
    }
});

// ======================
// User Profile Management (New Section)
// ======================
app.get('/api/user/profile', authenticate, async (req, res) => {
    
    
    try {
        // Fetch the user data from the database based on the ID from the token
        const [rows] = await db.query(
            "SELECT id, username, email FROM users WHERE id = ?", 
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "User profile not found." });
        }

        const user = rows[0];
        
        // Return only the essential, non-sensitive data (like name and email)
        res.json({
            name: user.username, // Assuming 'username' is what you display as 'name'
            email: user.email,
        });

    } catch (err) {
        console.error("❌ Error fetching user profile:", err.message);
        res.status(500).json({ error: "Server error while fetching profile." });
    }
});


app.put('/api/user/profile', authenticate, async (req, res) => {
    const userId = req.user.id;
    const { name, email } = req.body; // Data sent from the frontend

    // 1. Validation
    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required." });
    }

    try {
        // 2. Update the user record in the database
        const [result] = await db.query(
            "UPDATE users SET username = ?, email = ? WHERE id = ?",
            [name, email, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found or no changes applied." });
        }

        // 3. Success Response
        res.json({
            message: "Profile updated successfully!",
            name: name, // Send back the new data for the frontend to update
            email: email
        });

    } catch (err) {
        console.error("❌ Error updating user profile:", err.message);
        // Check for specific errors, like a duplicate email constraint violation
        if (err.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: "Email already in use by another account." });
        }
        res.status(500).json({ error: "Internal server error during profile update." });
    }
});


// ✅ Download Meal Plan as CSV
app.get('/api/mealplan/download', authenticate, async (req, res) => {
    const userId = req.user.id;
    
    try {
        console.log(`✅ Authentication Passed for User ID: ${req.user.id}`); 
        // 1. Fetch the data (reusing your existing query logic)
        const [meals] = await db.query(
            `SELECT 
                mp.day_of_week, 
                mp.meal_type,
                r.name AS recipe_name, 
                r.description 
            FROM meal_planner mp 
            JOIN recipes r ON mp.recipe_id = r.id 
            WHERE mp.user_id = ?
            ORDER BY FIELD(mp.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                     mp.meal_type;`,
            [userId]
        );

        if (meals.length === 0) {
            return res.status(404).json({ error: 'Your meal plan is empty. Nothing to download.' });
        }

        // 2. Format the data into a CSV string
        const header = "Day,Meal Type,Recipe Name,Description\n";
        
        const csvRows = meals.map(meal => {
            // Escape double quotes and remove newlines from text fields
            const safeName = `"${meal.recipe_name.replace(/"/g, '""')}"`;
            const safeDesc = `"${(meal.description || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
            
            return `${meal.day_of_week},${meal.meal_type},${safeName},${safeDesc}`;
        });
        
        const csvString = header + csvRows.join('\n');

        // 3. Set headers to prompt a file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="mealplan.csv"');
        
        // 4. Send the CSV data
        res.status(200).send(csvString);

    } catch (err) {
        console.error("❌ Fatal Download Server Error:", err.message); 
        res.status(500).json({ error: "Server failed to generate download file." });
    }
});
// New route in your server code

import puppeteer from 'puppeteer'; 
// NOTE: Make sure all other dependencies (like express, db, isValid) 
// are also imported using 'import' syntax at the top of your file.

// This function must be defined where your Express app can see it.

// 2. Define the PDF generation function
async function generateMealPlanPDF(mealPlanData) {
    // ----------------------------------------------------------------
    // 1. Build the HTML content
    // ----------------------------------------------------------------
    let tableRows = '';
    
    // Loop through the data retrieved from the database
    mealPlanData.forEach(meal => {
        // We use the column names from your SQL query: day_of_week, meal_type, recipe_name, description
        
        // Sanitize the text content for HTML display
        const safeName = meal.recipe_name ? meal.recipe_name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        const safeDesc = meal.description ? meal.description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n|\r/g, ' ') : '';
        
        tableRows += `
            <tr>
                <td>${meal.day_of_week}</td>
                <td>${meal.meal_type}</td>
                <td><strong>${safeName}</strong></td>
                <td>${safeDesc}</td>
            </tr>
        `;
    });

    const finalHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Weekly Meal Plan</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; text-align: center; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                .meal-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 20px;
                }
                .meal-table th, .meal-table td {
                    border: 1px solid #ccc;
                    padding: 8px 12px;
                    text-align: left;
                    vertical-align: top;
                }
                .meal-table th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                    color: #555;
                }
            </style>
        </head>
        <body>
            <h1>Your Weekly Meal Plan</h1>
            <table class="meal-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Meal Type</th>
                        <th>Recipe Name</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <footer><p style="text-align: center; font-size: 10px; margin-top: 30px;">Generated by Nutri-Meal Planner</p></footer>
        </body>
        </html>
    `;
    // ----------------------------------------------------------------

    // 2. Use Puppeteer to convert the HTML string into a PDF buffer
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', // Use 'new' or true for modern headless mode
            // Required for running in environments like Docker or remote servers
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        // Wait for the HTML content to be fully loaded and rendered
        await page.setContent(finalHTML, { waitUntil: 'networkidle0' }); 
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true, // Crucial for including background colors/styles
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
        });

        return pdfBuffer;

    } catch (error) {
        console.error("Puppeteer PDF generation failed:", error);
        throw new Error("Failed to create PDF file."); // Re-throw a simpler error
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// ----------------------------------------------------------------
// 🛑 New API Endpoint for PDF Download 🛑
// ----------------------------------------------------------------
app.get('/api/mealplan/pdf', authenticate, async (req, res) => {
    // The 'authenticate' middleware adds req.user.id
    const userId = req.user.id; 
    
    try {
        // 1. Data Retrieval: Fetch the data exactly as your CSV endpoint does
        // This ensures the data structure matches what generateMealPlanPDF expects
        const [meals] = await db.query(
            `SELECT 
                mp.day_of_week, 
                mp.meal_type,
                r.name AS recipe_name, 
                r.description 
            FROM meal_planner mp 
            JOIN recipes r ON mp.recipe_id = r.id 
            WHERE mp.user_id = ?
            ORDER BY FIELD(mp.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                     mp.meal_type;`,
            [userId]
        );

        if (meals.length === 0) {
            return res.status(404).json({ error: 'Your meal plan is empty. Nothing to download.' });
        }

        // 2. PDF Generation
        // Pass the fetched array directly to the generator function
        const pdfBuffer = await generateMealPlanPDF(meals); 
        
        // 3. Send the PDF file back to the user
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="MealPlan.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ PDF Download Server Error:', error.message);
        res.status(500).json({ error: "Server failed to generate the PDF file." });
    }
});
// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

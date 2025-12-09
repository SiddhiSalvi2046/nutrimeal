// LOGIN.JS (CORRECTED)
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const messageElement = document.getElementById("login-message");
    messageElement.textContent = "Logging in...";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        // 🛑 CRITICAL FIX: Read the response body ONCE
        const data = await res.json();
        console.log("Login response:", data);
        console.log("Saving to localStorage:", {
  token: data.token,
  role: data.role,
  userRole: data.user ? data.user.role : null
});


        if (res.ok) {
            // Success
            messageElement.textContent = `Login successful! Redirecting...`;
            
            // 1. Store the token and role CRITICALLY
           

// 🛑 CRITICAL FIX: Ensure you are saving the EXACT keys your admin.js is looking for.
localStorage.setItem('authToken', data.token);
//🧠 Flexible fallback — works whether the role is top-level or inside `user`
const roleToStore = data.role || (data.user && data.user.role);
localStorage.setItem('role', roleToStore);
console.log("✅ Role stored:", roleToStore);
localStorage.setItem('role', data.role);


            // 2. Handle Redirection based on Role
            if (data.role === 'admin') {
                window.location.href = '/admin-dashboard.html';
            } else {
                window.location.href = '/index.html';
            }
        } else {
            // Login failed (e.g., 401 Invalid credentials)
            messageElement.textContent = `Error: ${data.error || "Login failed."}`;
            alert(data.error || "Login request failed.");
        }
    } catch (err) {
        console.error("❌ Login failed:", err);
        messageElement.textContent = "Network or server error during login.";
        alert("Login request failed.");
    }
});
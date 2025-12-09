import jwt from "jsonwebtoken";
export function authenticate(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  console.log("--- AUTH DEBUG ---");
  console.log("Token received:", token);
  console.log("Secret used:", process.env.JWT_SECRET);
  console.log("------------------");
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
        console.error("JWT Verification ERROR:", err.message); // Log the specific error message
        return res.status(403).json({ error: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}
export function isAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    if (req.user.role === 'admin') {
        next(); 
    } else {
        res.status(403).json({ error: "Access Denied. Administrator privileges required." });
    }
}
/*export function protectAdminRoute(req, res, next) {
    // 1. Authenticate the user (verify token)
    authenticate(req, res, (err) => {
        if (err) {
            // If authenticate returns an error, it sends the response (401/403) and stops.
            return; 
        }
        
        // 2. If authentication succeeds, check the role
        isAdmin(req, res, next);
    });
}*/
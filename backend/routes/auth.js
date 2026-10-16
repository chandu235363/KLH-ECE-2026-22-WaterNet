const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "waternet-super-secret-key-pbl-2026";

// Auth verification middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

// 1. Register: stores userid, name, hashed pwd in PostgreSQL table
router.post("/register", async (req, res) => {
  const { userid, name, pwd } = req.body;

  if (!userid || !name || !pwd) {
    return res.status(400).json({ error: "userid, name, and pwd are required" });
  }

  if (typeof userid !== "string" || typeof pwd !== "string" || typeof name !== "string") {
    return res.status(400).json({ error: "Invalid input types" });
  }

  try {
    // Check if userid already exists in the PostgreSQL table
    const existing = await query("SELECT id FROM users WHERE userid = $1", [userid.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "A user with this User ID already exists" });
    }

    // Hash password with bcrypt - never store plaintext passwords
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(pwd, saltRounds);

    // Insert user into PostgreSQL users table
    const result = await query(
      "INSERT INTO users (userid, name, pwd) VALUES ($1, $2, $3) RETURNING id, userid, name, created_at",
      [userid.trim(), name.trim(), hashedPassword]
    );

    const newUser = result.rows[0];

    // Issue JWT token
    const token = jwt.sign(
      { id: newUser.id, userid: newUser.userid, name: newUser.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser.id,
        userid: newUser.userid,
        name: newUser.name,
      },
    });
  } catch (err) {
    console.error("Error during registration:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Login: checks credentials against the PostgreSQL users table only
router.post("/login", async (req, res) => {
  const { userid, pwd } = req.body;

  if (!userid || !pwd) {
    return res.status(400).json({ error: "userid and pwd are required" });
  }

  try {
    // Check PostgreSQL users table
    const result = await query(
      "SELECT id, userid, name, pwd FROM users WHERE userid = $1",
      [userid.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid userid or password" });
    }

    const user = result.rows[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(pwd, user.pwd);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid userid or password" });
    }

    // Issue JWT token
    const token = jwt.sign(
      { id: user.id, userid: user.userid, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        userid: user.userid,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Me: verify token and load user profile from PostgreSQL
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, userid, name, created_at FROM users WHERE userid = $1",
      [req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Error fetching current user:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = {
  router,
  requireAuth,
};

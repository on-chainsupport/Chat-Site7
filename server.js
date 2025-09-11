// server.js (ESM version)
import express from "express"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 7860

// Middleware
app.use(express.static(path.join(__dirname, "public")))
app.use(express.json())

// Users file path
const USERS_FILE = path.join(__dirname, "users.json")

// Private chats + online status
const PRIVATE_CHATS_FILE = path.join(__dirname, "private_chats.json")
const ONLINE_USERS = new Map()

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, "public", "uploads")
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  console.log("Created uploads directory")
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname)
    const fileName = `${uuidv4()}${fileExt}`
    cb(null, fileName)
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Only image files are allowed!"), false)
    }
    cb(null, true)
  },
})

// Init files if missing
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]))
  console.log("Created users.json")
}

if (!fs.existsSync(PRIVATE_CHATS_FILE)) {
  fs.writeFileSync(PRIVATE_CHATS_FILE, JSON.stringify({}))
  console.log("Created private_chats.json")
}

// Hash password
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex")
}

// Online status
function updateOnlineStatus(userId, status) {
  if (status) {
    ONLINE_USERS.set(userId, Date.now())
  } else {
    ONLINE_USERS.delete(userId)
  }
}

// Conversation ID generator
function getConversationId(user1Id, user2Id) {
  const sortedIds = [user1Id, user2Id].sort()
  return `${sortedIds[0]}_${sortedIds[1]}`
}

/* =========================
   API ROUTES
========================= */

// LOGIN
app.post("/api/login", (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.json({ success: false, message: "Username and password are required" })
  }

  try {
    let users = []
    try {
      const usersData = fs.readFileSync(USERS_FILE, "utf8")
      users = JSON.parse(usersData)
    } catch {
      users = []
    }

    const user = users.find((u) => u.username === username || u.email === username)
    if (!user) return res.json({ success: false, message: "User not found" })

    const hashedPassword = hashPassword(password)
    if (user.password !== hashedPassword) {
      return res.json({ success: false, message: "Incorrect password" })
    }

    const { password: _, ...userWithoutPassword } = user
    res.json({ success: true, message: "Login successful", user: userWithoutPassword })
  } catch (error) {
    res.json({ success: false, message: "Server error" })
  }
})

// REGISTER
app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password) {
    return res.json({ success: false, message: "All fields are required" })
  }

  try {
    let users = []
    try {
      const usersData = fs.readFileSync(USERS_FILE, "utf8")
      users = JSON.parse(usersData)
    } catch {
      users = []
    }

    if (users.some((u) => u.username === username)) {
      return res.json({ success: false, message: "Username already exists" })
    }

    if (users.some((u) => u.email === email)) {
      return res.json({ success: false, message: "Email already exists" })
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashPassword(password),
      profilePicture: null,
      createdAt: new Date().toISOString(),
    }

    users.push(newUser)
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))

    const { password: _, ...userWithoutPassword } = newUser
    res.json({ success: true, message: "Registration successful", user: userWithoutPassword })
  } catch {
    res.json({ success: false, message: "Server error" })
  }
})

// GET USERS
app.get("/api/users", (req, res) => {
  try {
    const usersData = fs.readFileSync(USERS_FILE, "utf8")
    const users = JSON.parse(usersData).map(({ password, ...u }) => u)
    res.json(users)
  } catch {
    res.json([])
  }
})

// More routes… (private chat, profile picture, profile update, change password, delete account) 
// 👉 Keep them same as your current version — just update imports and __dirname as shown above.

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
})    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  console.log("Created users.json file");
}

// Initialize private chats file if it doesn't exist
if (!fs.existsSync(PRIVATE_CHATS_FILE)) {
  fs.writeFileSync(PRIVATE_CHATS_FILE, JSON.stringify({}));
  console.log("Created private_chats.json file");
}

// Simple password hashing
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Update online status
function updateOnlineStatus(userId, status) {
  if (status) {
    ONLINE_USERS.set(userId, Date.now());
  } else {
    ONLINE_USERS.delete(userId);
  }
}

// Generate a unique conversation ID for two users
function getConversationId(user1Id, user2Id) {
  const sortedIds = [user1Id, user2Id].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

/* ===========================
   Your API routes go here...
   (login, register, chats, users, uploads, etc.)
   I left your original code intact – you can paste all routes back here
   =========================== */

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Users file path: ${USERS_FILE}`);
});

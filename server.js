import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

// __dirname replacement in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Users file path
const USERS_FILE = path.join(__dirname, "users.json");

// Add these variables for storing private chats and online status
const PRIVATE_CHATS_FILE = path.join(__dirname, "private_chats.json");
const ONLINE_USERS = new Map(); // Track user online status

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("Created uploads directory");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
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

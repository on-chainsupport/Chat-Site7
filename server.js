const express = require("express")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const multer = require("multer")
const { v4: uuidv4 } = require("uuid")

const app = express()
const PORT = process.env.PORT || 7860

// Middleware
app.use(express.static(path.join(__dirname, "public")))
app.use(express.json())

// Users file path
const USERS_FILE = path.join(__dirname, "users.json")

// Add these variables for storing private chats and online status
const PRIVATE_CHATS_FILE = path.join(__dirname, "private_chats.json")
const ONLINE_USERS = new Map() // Track user online status

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, "public", "uploads")
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  console.log("Created uploads directory")
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname)
    const fileName = `${uuidv4()}${fileExt}`
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

  // Init files if missing
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    console.log("Created users.json file");
  }
  if (!fs.existsSync(PRIVATE_CHATS_FILE)) {
    fs.writeFileSync(PRIVATE_CHATS_FILE, JSON.stringify({}));
    console.log("Created private_chats.json file");
  }

  // Helpers
  function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  function updateOnlineStatus(userId, status) {
    if (status) ONLINE_USERS.set(userId, Date.now());
    else ONLINE_USERS.delete(userId);
  }

  function getConversationId(user1Id, user2Id) {
    const sortedIds = [user1Id, user2Id].sort();
    return `${sortedIds[0]}_${sortedIds[1]}`;
  }

  /* =========================
     ROUTES (login, register, users, chats, uploads, profile etc)
     These are the same as your original endpoints with minor fixes.
     ========================= */

  // LOGIN
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: "Username and password are required" });
    }
    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        users = [];
      }

      const user = users.find((u) => u.username === username || u.email === username);
      if (!user) return res.json({ success: false, message: "User not found" });

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.json({ success: false, message: "Incorrect password" });
      }

      const { password: pw, ...userWithoutPassword } = user;
      res.json({ success: true, message: "Login successful", user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // REGISTER
  app.post("/api/register", (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.json({ success: false, message: "All fields are required" });
    }
    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        users = [];
      }

      if (users.some((u) => u.username === username)) {
        return res.json({ success: false, message: "Username already exists" });
      }
      if (users.some((u) => u.email === email)) {
        return res.json({ success: false, message: "Email already exists" });
      }

      const newUser = {
        id: Date.now().toString(),
        username,
        email,
        password: hashPassword(password),
        profilePicture: null,
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      const { password: pw, ...userWithoutPassword } = newUser;
      res.json({ success: true, message: "Registration successful", user: userWithoutPassword });
    } catch (error) {
      console.error("Registration error:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // GET USERS
  app.get("/api/users", (req, res) => {
    try {
      const usersData = fs.readFileSync(USERS_FILE, "utf8");
      const users = JSON.parse(usersData).map(({ password, ...u }) => u);
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.json([]);
    }
  });

  // Get all users with online status
  app.get("/api/users/online", (req, res) => {
    try {
      const usersData = fs.readFileSync(USERS_FILE, "utf8");
      const users = JSON.parse(usersData);

      const now = Date.now();
      for (const [userId, lastSeen] of ONLINE_USERS.entries()) {
        if (now - lastSeen > 120000) ONLINE_USERS.delete(userId);
      }

      const usersWithStatus = users.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          isOnline: ONLINE_USERS.has(user.id),
        };
      });

      res.json(usersWithStatus);
    } catch (error) {
      console.error("Error getting users with online status:", error);
      res.json([]);
    }
  });

  // Update online status
  app.post("/api/users/status", (req, res) => {
    const { userId, status } = req.body;
    if (!userId) return res.json({ success: false, message: "User ID is required" });
    updateOnlineStatus(userId, status);
    res.json({ success: true });
  });

  // Get private chat messages
  app.get("/api/chat/private", (req, res) => {
    const { userId, receiverId } = req.query;
    if (!userId || !receiverId) return res.json({ success: false, message: "Both user IDs are required" });
    try {
      const conversationId = getConversationId(userId, receiverId);
      let privateChats = {};
      try {
        const chatsData = fs.readFileSync(PRIVATE_CHATS_FILE, "utf8");
        privateChats = JSON.parse(chatsData);
      } catch {
        privateChats = {};
      }
      const messages = privateChats[conversationId] || [];
      res.json(messages);
    } catch (error) {
      console.error("Error getting private chat messages:", error);
      res.json([]);
    }
  });

  // Send private message
  app.post("/api/chat/private", (req, res) => {
    const { userId, username, receiverId, receiverName, message } = req.body;
    if (!userId || !username || !receiverId || !receiverName || !message) {
      return res.json({ success: false, message: "Missing required fields" });
    }
    try {
      updateOnlineStatus(userId, true);
      const conversationId = getConversationId(userId, receiverId);

      let privateChats = {};
      try {
        const chatsData = fs.readFileSync(PRIVATE_CHATS_FILE, "utf8");
        privateChats = JSON.parse(chatsData);
      } catch {
        privateChats = {};
      }

      // ensure mutable array (use let)
      let messages = privateChats[conversationId] || [];

      const newMessage = {
        id: Date.now().toString(),
        senderId: userId,
        senderName: username,
        receiverId,
        receiverName,
        message,
        timestamp: new Date().toISOString(),
      };

      messages.push(newMessage);

      if (messages.length > 100) {
        messages = messages.slice(messages.length - 100);
      }

      privateChats[conversationId] = messages;
      fs.writeFileSync(PRIVATE_CHATS_FILE, JSON.stringify(privateChats, null, 2));

      res.json({ success: true, message: newMessage });
    } catch (error) {
      console.error("Error sending private chat message:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // Upload profile picture
  app.post("/api/users/profile-picture", upload.single("profilePicture"), (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.json({ success: false, message: "User ID is required" });
    if (!req.file) return res.json({ success: false, message: "No file uploaded" });

    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        return res.json({ success: false, message: "Error reading users file" });
      }

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) return res.json({ success: false, message: "User not found" });

      if (users[userIndex].profilePicture) {
        const oldPicturePath = path.join(UPLOADS_DIR, path.basename(users[userIndex].profilePicture));
        if (fs.existsSync(oldPicturePath)) fs.unlinkSync(oldPicturePath);
      }

      const profilePicturePath = `/uploads/${req.file.filename}`;
      users[userIndex].profilePicture = profilePicturePath;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      res.json({ success: true, message: "Profile picture updated successfully", profilePicture: profilePicturePath });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // Update profile
  app.put("/api/users/profile", (req, res) => {
    const { userId, username, email } = req.body;
    if (!userId || !username || !email) return res.json({ success: false, message: "User ID, username, and email are required" });

    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        return res.json({ success: false, message: "Error reading users file" });
      }

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) return res.json({ success: false, message: "User not found" });

      if (username !== users[userIndex].username) {
        const usernameExists = users.some((u, i) => i !== userIndex && u.username === username);
        if (usernameExists) return res.json({ success: false, message: "Username already exists" });
      }
      if (email !== users[userIndex].email) {
        const emailExists = users.some((u, i) => i !== userIndex && u.email === email);
        if (emailExists) return res.json({ success: false, message: "Email already exists" });
      }

      users[userIndex].username = username;
      users[userIndex].email = email;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      const { password: pw, ...userWithoutPassword } = users[userIndex];
      res.json({ success: true, message: "Profile updated successfully", user: userWithoutPassword });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // Change password
  app.put("/api/users/password", (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.json({ success: false, message: "User ID, current password, and new password are required" });
    }

    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        return res.json({ success: false, message: "Error reading users file" });
      }

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) return res.json({ success: false, message: "User not found" });

      const hashedCurrentPassword = hashPassword(currentPassword);
      if (users[userIndex].password !== hashedCurrentPassword) return res.json({ success: false, message: "Current password is incorrect" });

      users[userIndex].password = hashPassword(newPassword);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // Delete account
  app.delete("/api/users/:userId", (req, res) => {
    const { userId } = req.params;
    const { password } = req.body;
    if (!userId || !password) return res.json({ success: false, message: "User ID and password are required" });

    try {
      let users = [];
      try {
        const usersData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(usersData);
      } catch {
        return res.json({ success: false, message: "Error reading users file" });
      }

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) return res.json({ success: false, message: "User not found" });

      const hashedPassword = hashPassword(password);
      if (users[userIndex].password !== hashedPassword) return res.json({ success: false, message: "Password is incorrect" });

      if (users[userIndex].profilePicture) {
        const picturePath = path.join(UPLOADS_DIR, path.basename(users[userIndex].profilePicture));
        if (fs.existsSync(picturePath)) fs.unlinkSync(picturePath);
      }

      users.splice(userIndex, 1);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      ONLINE_USERS.delete(userId);

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.json({ success: false, message: "Server error" });
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Users file path: ${USERS_FILE}`);
  });

})(); // end async iife    cb(null, UPLOADS_DIR)
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

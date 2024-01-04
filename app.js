const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

app.use(express.json());

app.use(cors());

const dbPath = path.join(__dirname, "musicdb.db");

let db = null;

const initDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const createVideosTableQuery = `
      CREATE TABLE if not exists videos (
        id INTEGER PRIMARY KEY,
        videoTitle TEXT,
        videoLink TEXT
      )
    `;

    const createStudentsTableQuery = `
      CREATE TABLE if not exists students (
        id INTEGER PRIMARY KEY,
        studentName TEXT,
        studentMobile TEXT,
        studentEmail TEXT,
        studentProfile TEXT,
        studentPassword TEXT
      )
    `;

    const createAdminsTableQuery = `
  CREATE TABLE if not exists admins (
    id INTEGER PRIMARY KEY,
    adminName TEXT,
    adminMobile TEXT,
    adminEmail TEXT,
    adminProfile TEXT,
    adminPassword TEXT
  )
`;

    const createGalleryQuery = `
        CREATE TABLE if not exists gallery (
            id INTEGER PRIMARY KEY,
            imageUrl text
        )
    `;

    // const hashP = await bcrypt.hash("admin", 10);

    // const addDummyadmin = `
    // insert into admins (adminName,adminMobile,adminEmail,adminProfile,adminPassword) values(?,?,?,?,?)`;
    // await db.run(addDummyadmin, [
    //   "admin2",
    //   "9879879879",
    //   "admin2@email.com",
    //   "admin@profile",
    //   hashP,
    // ]);
    await db.run(createVideosTableQuery);
    await db.run(createStudentsTableQuery);
    await db.run(createAdminsTableQuery);
    await db.run(createGalleryQuery);

    app.listen(3009, () => {
      console.log("Database server is up and running at localhost 3008");
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
  }
};

//Middleware function to check students added or not
const checkStudentAddedOrNot = async (req, res, next) => {
  const { details } = req.body;
  const { name, mobile, email, profile, password } = details;
  const checkStudentQuery = `SELECT * FROM students WHERE studentName=?`;
  try {
    const row = await db.get(checkStudentQuery, [name]);
    if (row) {
      res.status(409).json({ message: "Student details already exist" });
    } else {
      req.details = {
        name,
        email,
        mobile,
        profile,
        password,
      };
      next();
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error adding student failed" });
  }
};

//Middleware function for authorization
const adminAuthorization = async (req, res, next) => {
  const { details } = req.body;
  const authHeader = req.headers["authorization"];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const validToken = jwt.verify(token, "admin token");

      if (validToken) {
        req.details = req.body.details;
        next();
      } else {
        res.status(401).json({ message: "Invalid token" });
      }
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Unauthorized access" });
  }
};

// Add student
app.post(
  "/addStudent",
  adminAuthorization,
  checkStudentAddedOrNot,
  async (req, res) => {
    const { details } = req;
    const { name, email, mobile, profile, password } = details;

    try {
      const hashedPassword = await bcrypt.hash(password, 13);
      const addStudentQuery =
        "INSERT INTO students (studentName, studentEmail, studentMobile, studentProfile, studentPassword) VALUES (?, ?, ?, ?, ?)";
      await db.run(addStudentQuery, [
        name,
        email,
        mobile,
        profile,
        hashedPassword,
      ]);
      res.status(200).json({ message: "Student added successfully" });
    } catch (error) {
      res.status(500).json({ message: "Request failed" });
    }
  }
);

//Login student
app.post("/studentLogin", async (req, res) => {
  const { details } = req.body;
  const { username, password } = details;

  const checkStudentQuery =
    "SELECT * FROM students WHERE studentEmail = ? OR studentMobile = ?";

  db.get(checkStudentQuery, [username, username], (err, row) => {
    if (err) {
      res.status(500).json({ message: "request failed" });
    } else if (!row) {
      res.status(401).send("Invalid username");
    } else {
      bcrypt.compare(password, row.studentPassword, (bcryptErr, bcryptRes) => {
        if (bcryptErr) {
          res
            .status(500)
            .json({ message: "Error occurred while comparing passwords" });
        } else if (bcryptRes) {
          const payLoad = { id: row.id, studentName: row.studentName };
          const jwtToken = jwt.sign(payLoad, "student token");
          res.status(200).json({ jwtToken: { jwtToken } });
        } else {
          res.status(401).json({ message: "Invalid password" });
        }
      });
    }
  });
});

// Add video
app.post("/addVideo", adminAuthorization, async (req, res) => {
  try {
    const { details } = req.details;
    const { videoTitle, videoLink } = details;
    const addVideoQuery =
      "insert into videos (videoTitle,videoLink) values(?,?)";
    db.run(addVideoQuery, [videoTitle, videoLink]);
    res.status(200).json({ message: "Video added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Video adding failed" });
  }
});

//Get video
app.get("/search", async (req, res) => {
  const { videoTitle } = req.query;

  const getVideoQuery = `SELECT * FROM videos WHERE videoTitle LIKE ?`;

  try {
    db.all(getVideoQuery, [`%${videoTitle}%`], (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(200).json({ video_details: rows });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all videos
app.get("/allVideos", async (req, res) => {
  try {
    const allVideosQuery = "SELECT * FROM videos";
    db.all(allVideosQuery, (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(200).json({ videos: rows });
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error in getting videos" });
  }
});

// Add admin
app.post("/add-admin", adminAuthorization, async (req, res) => {
  try {
    const { details } = req.body;
    const { name, password, mobile, email, profile } = details;
    const checkForAdmin =
      "SELECT * FROM admins WHERE adminMobile=? OR adminEmail=?";
    const row = await db.get(checkForAdmin, [mobile, email]);

    if (row) {
      res.status(401).json({ message: "Admin details already exist" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 13);
      const addAdminQuery =
        "INSERT INTO admins (adminName, adminMobile, adminEmail, adminProfile, adminPassword) VALUES (?, ?, ?, ?, ?)";
      await db.run(addAdminQuery, [
        name,
        mobile,
        email,
        profile,
        hashedPassword,
      ]);
      res.status(200).json({ message: "Admin added successfully" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error in checking/admin addition" });
  }
});

//Admin login
//Admin login
app.post("/admin-login", async (req, res) => {
  const { details } = req.body;
  const { username, password } = details;

  const checkAdmin = "SELECT * FROM admins WHERE adminMobile=? OR adminEmail=?";

  try {
    const row = await db.get(checkAdmin, [username, username]);

    if (!row) {
      res.status(400).json({ message: "Admin details not found" });
    } else {
      const passwordMatched = await bcrypt.compare(password, row.adminPassword);

      if (passwordMatched) {
        const payLoad = { id: row.id, admin_name: row.adminName };
        const jwtToken = jwt.sign(payLoad, "admin token");
        res.status(200).json({ jwtToken });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Internal error" });
  }
});

//Add images to gallery
app.post("/add-to-gallery", adminAuthorization, async (req, res) => {
  try {
    const { details } = req.body;
    const { imageUrl } = details;
    const addImageQuery = "INSERT INTO gallery(imageUrl) VALUES (?)";
    await db.run(addImageQuery, [imageUrl]);
    res.status(200).json({ message: "Image added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Sample for checking
app.get("/sample", async (req, res) => {
  res.status(200).json({ message: "sample response fetched successfully" });
});

app.get("/sample2", async (req, res) => {
  res.status(200).json({ message: "sample 2 for response checking" });
});

initDbAndServer();

const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

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

    await db.run(createVideosTableQuery);
    await db.run(createStudentsTableQuery);
    await db.run(createAdminsTableQuery);

    app.listen(3000, () => {
      console.log("Database server is up and running at localhost 3000");
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
  }
};

initDbAndServer();

//Middleware function to check student added or not

const checkStudentAddedOrNot = async (req, res, next) => {
  const { studentName, studentMobile, studentEmail, studentProfile } = req.body;
  const checkStudentQuery = `select * from students where studentName=?`;
  db.get(checkStudentQuery, [studentName], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).send("Internal server error adding student failed");
    } else if (row) {
      res.status(409).send("Student details already exists");
    } else {
      req.studentDetails = {
        studentName,
        studentEmail,
        studentMobile,
        studentProfile,
      };
      next();
    }
  });
};

// Adding student

app.post("/addStudent", checkStudentAddedOrNot, async (req, res) => {
  const { studentDetails } = req;
  const {
    studentName,
    studentEmail,
    studentMobile,
    studentProfile,
    studentPassword,
  } = studentDetails;

  const hashedPassword = bcrypt.hash(studentPassword, 13);

  try {
    const addStudentQuery =
      "INSERT INTO students (studentName, studentEmail, studentMobile, studentProfile, studentPassword) VALUES (?, ?, ?, ?)";
    await db.run(addStudentQuery, [
      studentName,
      studentEmail,
      studentMobile,
      studentProfile,
      hashedPassword,
    ]);
    res.status(200).send("Student added successfully");
  } catch (error) {
    res.status(500).send("Student adding failed");
  }
});

//Login student

app.post("/studentLogin", async (req, res) => {
  const { loginDetails } = req.body;
  const { username, password } = loginDetails;

  const checkStudentQuery =
    "SELECT * FROM students WHERE studentEmail = ? OR studentMobile = ?";

  db.get(checkStudentQuery, [username, username], (err, row) => {
    if (err) {
      res.status(500).send(err.message);
    } else if (!row) {
      res.status(401).send("Invalid username");
    } else {
      bcrypt.compare(password, row.studentPassword, (bcryptErr, bcryptRes) => {
        if (bcryptErr) {
          res.status(500).send("Error occurred while comparing passwords");
        } else if (bcryptRes) {
          const payLoad = { id: row.id, studentName: row.studentName };
          const jwtToken = jwt.sign(
            payLoad,
            "this is sample secret code for generating the jwt token"
          );
          res.status(200).send({ jwtToken });
        } else {
          res.status(401).send("Invalid password");
        }
      });
    }
  });
});

// Add video
app.post("/addVideo", async (req, res) => {
  const { videoTitle, videoLink } = req.body;
  const addVideoQuery = "insert into videos (videoTitle,videoLink) values(?,?)";
  try {
    await db.run(addVideoQuery, [videoTitle, videoLink]);
    res.status(200).send("Video added successfully");
  } catch (error) {
    res.status(500).send("Video added failed");
  }
});

//Get video
app.get("/search", async (req, res) => {
  const { videoTitle } = req.query;

  const getVideoQuery = `select * from video where videoTitle like ?`;

  try {
    await db.all(getVideoQuery, [`%${videoTitle}%`], (err, rows) => {
      if (err) {
        res.send(err.message);
      } else {
        res.status(200).send(rows);
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get all videos
app.get("/allVideos", async (req, res) => {
  try {
    const allVideosQuery = "select * from videos";
    await db.run(allVideosQuery, (err, rows) => {
      if (err) {
        res.send(err);
      } else {
        res.status(200).send(rows);
      }
    });
  } catch (error) {}
});

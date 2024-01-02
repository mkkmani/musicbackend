const express = require('express')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const app = express()

const dbPath = path.join(__dirname, 'musicdb.db')

let db = null

const initDbAndServer = async () => {
  try {
    db = await open({
    filename: dbPath,
    driver:sqlite3.Database
  })
  } catch (error) {
    console.log(`DB error: ${error.message}`)
  }

  const videosTableQuery = 'create table if not exists videos(id integer primary key,video_name,video_link)'
  db.run(videosTableQuery)

  db.close((err) => {
    if (err) {
      console.error(err.message)
    } else {
      console.log('Database closed successfully')
    }
  })

  app.listen(3000, () => {
    console.log('Database server is up and running at localhost 3000')
  })
}

initDbAndServer()
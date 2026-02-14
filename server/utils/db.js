const chalk = require("chalk");
const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/../.env" }); // <-- load .env explicitly

const keys = require("../config/keys");
const { database } = keys;

const setupDB = async () => {
  if (mongoose.connection.readyState) return; // Already connected

  try {
    if (!database.url) {
      throw new Error("MongoDB URI is undefined! Check your server/.env file");
    }

    await mongoose.connect(database.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });

    console.log(`${chalk.green("✓")} ${chalk.blue("MongoDB Connected!")}`);
  } catch (err) {
    console.error(`${chalk.red("❌ MongoDB connection failed:")}`, err);
    process.exit(1);
  }
};

module.exports = setupDB;

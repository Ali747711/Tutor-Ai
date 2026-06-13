"use strict";

const mongoose = require("mongoose");

let _promise = null;

function connectDb() {
  if (_promise) return _promise;

  const url = process.env.DB_URL;
  if (!url) {
    return Promise.reject(new Error("DB_URL not configured"));
  }

  _promise = mongoose
    .connect(url, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((err) => {
      _promise = null; // allow retry on next call
      throw err;
    });

  return _promise;
}

module.exports = { connectDb };

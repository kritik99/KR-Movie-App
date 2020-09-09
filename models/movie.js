var mongoose = require("mongoose");

// SCHEME SETUP
var movieSchema = new mongoose.Schema({
  name: String,
  imdb: Number,
  image: String,
  imageId: String,
  description: String,
  director: String,
  release: String,
  tags: [],
  createdAt: { type: Date, default: Date.now },
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    username: String
  },
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment"
    }
  ],
  rateAvg: Number,
  rateCount: Number,
  hasRated: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
});

module.exports = mongoose.model("Movie", movieSchema);

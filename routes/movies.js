var express = require("express");
var router = express.Router();
var Movie = require("../models/movie");
var middleware = require("../middleware");

var multer = require("multer");
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function(req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};
var upload = multer({
  storage: storage,
  fileFilter: imageFilter
});

var cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: process.env.NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

var Fuse = require("fuse.js");

// INDEX - show all movies
router.get("/", function(req, res) {
  var noMatch = null;
  if (req.query.search) {
    Movie.find({}, function(err, allMovies) {
      if (err) {
        console.log(err);
      } else {        
        var options = {
          shouldSort: true,
          threshold: 0.5,
          location: 0,
          distance: 100,
          maxPatternLength: 32,
          minMatchCharLength: 2,
          keys: ["name", "location"]
        };
        var fuse = new Fuse(allMovies, options);
        var result = fuse.search(req.query.search);
        if (result.length < 1) {
          noMatch = req.query.search;
        }
        res.render("movies/index", {
          movies: result,
          noMatch: noMatch
        });
      }
    });
  } else if (req.query.sortby) {
    if (req.query.sortby === "rateAvg") {
      Movie.find({})
        .sort({
          // rateCount: -1,
          rateAvg: -1
        })
        .exec(function(err, allMovies) {
          if (err) {
            console.log(err);
          } else {
            res.render("movies/index", {
              movies: allMovies,
              currentUser: req.user,
              noMatch: noMatch
            });
          }
        });
    } else if (req.query.sortby === "rateCount") {
      Movie.find({})
        .sort({
          rateCount: -1
        })
        .exec(function(err, allMovies) {
          if (err) {
            console.log(err);
          } else {
            res.render("movies/index", {
              movies: allMovies,
              currentUser: req.user,
              noMatch: noMatch
            });
          }
        });
    } else if (req.query.sortby === "imdbLow") {
      Movie.find({})
        .sort({
          imdb: 1,
          rateAvg: -1
        })
        .exec(function(err, allMovies) {
          if (err) {
            console.log(err);
          } else {
            res.render("movies/index", {
              movies: allMovies,
              currentUser: req.user,
              noMatch: noMatch
            });
          }
        });
    } else {
      Movie.find({})
        .sort({
          imdb: -1,
          rateAvg: -1
        })
        .exec(function(err, allMovies) {
          if (err) {
            console.log(err);
          } else {
            res.render("movies/index", {
              movies: allMovies,
              currentUser: req.user,
              noMatch: noMatch
            });
          }
        });
    }
  } else {
    Movie.find({}, function(err, allMovies) {
      if (err) {
        console.log(err);
      } else {
        res.render("movies/index", {
          movies: allMovies,
          currentUser: req.user,
          noMatch: noMatch
        });
      }
    });
  }
});

// CREATE - add new movie to db
router.post("/", middleware.isLoggedIn, upload.single("image"), function(req,res){
  cloudinary.v2.uploader.upload(
    req.file.path,
    {
      width: 1500,
      height: 1000,
      crop: "scale"
    },
    function(err, result) {
      if (err) {
        req.flash("error", err.message);
        // console.log("1");
        return res.render("error");
      }
      req.body.movie.image = result.secure_url;
      req.body.movie.imageId = result.public_id;
      req.body.movie.release = req.body.movie.release;
      req.body.movie.tags = req.body.movie.tags.split(",");
      req.body.movie.author = {
        id: req.user._id,
        username: req.user.username
      };
        Movie.create(req.body.movie, function(err, movie) {
          if (err) {
          // console.log("3");
            req.flash("error", err.message);
            return res.render("error");
          }
          res.redirect("/movies");
        });
    }
  );
});

// NEW - show form to create new movie
router.get("/new", middleware.isLoggedIn, function(req, res) {
  res.render("movies/new");
});

// SHOW - shows more information about one movie
router.get("/:id", function(req, res) {
  Movie.findById(req.params.id)
    .populate("comments")
    .exec(function(err, foundMovie) {
      if (err || !foundMovie) {
        console.log(err);
        req.flash("error", "Sorry, that movie does not exist!");
        return res.render("error");
      }
      var ratingsArray = [];

      foundMovie.comments.forEach(function(rating) {
        ratingsArray.push(rating.rating);
      });
      if (ratingsArray.length === 0) {
        foundMovie.rateAvg = 0;
      } else {
        var ratings = ratingsArray.reduce(function(total, rating) {
          return total + rating;
        });
        foundMovie.rateAvg = ratings/foundMovie.comments.length;
        foundMovie.rateCount = foundMovie.comments.length;
      }
      foundMovie.save();
      res.render("movies/show", {
        movie: foundMovie
      });
    });
});

// EDIT MOVIE ROUTE
router.get(
  "/:id/edit",
  middleware.isLoggedIn,
  middleware.checkMovieOwnership,
  function(req, res) {
    res.render("movies/edit", {
      movie: req.movie
    });
  }
);

// UPDATE MOVIE ROUTE
router.put("/:id",upload.single("image"),middleware.checkMovieOwnership,
  function(req, res) {
      req.body.movie.release = req.body.movie.release;
      req.body.movie.tags = req.body.movie.tags.split(",");
      Movie.findByIdAndUpdate(
        req.params.id,
        req.body.movie,
        async function(err, movie) {
          if (err) {
            req.flash("error", err.message);
            res.redirect("back");
          } else {
            if (req.file) {
              try {
                await cloudinary.v2.uploader.destroy(movie.imageId);
                var result = await cloudinary.v2.uploader.upload(
                  req.file.path,
                  {
                    width: 1500,
                    height: 1000,
                    crop: "scale"
                  }
                );
                movie.imageId = result.public_id;
                movie.image = result.secure_url;
              } catch (err) {
                req.flash("error", err.message);
                return res.render("error");
              }
            }
            movie.save();
            req.flash("success", "Successfully updated your movie!");
            res.redirect("/movies/" + req.params.id);
          }
        }
      );
  }
);

// DESTROY MOVIE ROUTE
router.delete("/:id", middleware.checkMovieOwnership, function(req, res) {
  Movie.findById(req.params.id, async function(err, movie) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
      await cloudinary.v2.uploader.destroy(movie.imageId);
      movie.remove();
      res.redirect("/movies");
    } catch (err) {
      if (err) {
        req.flash("error", err.message);
        return res.render("error");
      }
    }
  });
});

module.exports = router;

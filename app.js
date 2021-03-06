// Requiring the main packages
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const passwordValidator = require('password-validator');
const emailValidator = require("email-validator");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const bcrypt = require('bcrypt');
const {
  assert
} = require('console');
const {
  type
} = require('os');
const saltRounds = 10;

// Setting up the main packages
const app = express();
app.set('view engine', 'ejs');
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});
mongoose.set('useCreateIndex', true);

// Adds the model for a user
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    minLength: 3,
    maxLength: 20,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  friends: {
    type: [mongoose.ObjectId],
    required: false
  },
  requestedFriends: {
    type: [mongoose.ObjectId],
    required: false
  },
  favoriteGames: {
    type: Array,
    of: String,
    required: true
  },
  status: {
    type: String
  },
  inQueue: {
    type: Boolean
  },
  currentQueue: {
    type: mongoose.ObjectId
  }
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

// Adds the model for a queue
const queueSchema = new mongoose.Schema({
  game: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false,
    maxLength: 100
  },
  visibility: {
    type: Boolean,
    /* true: public
    false: private */
    required: true
  },
  lobby: {
    type: Array,
    of: mongoose.ObjectId,
    required: true
  },
  waiting: {
    type: Array,
    of: String,
    required: false
  },
  full: {
    type: Boolean,
    required: false
  },
  creator: {
    type: mongoose.ObjectId,
    required: true
  }
});

const Queue = new mongoose.model("Queue", queueSchema);

// Password validator scheme
var pswdSchema = new passwordValidator();
pswdSchema
  .is().min(8) // Minimum length 8
  .is().max(30) // Maximum length 30
  .has().uppercase() // Must have uppercase letters
  .has().lowercase() // Must have lowercase letters
  .has().digits(1) // Must have at least 1 digit
  .has().not().spaces(); // Spaces not allowed

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// Adds route for main page and renders it
app.route("/")
  .get(function (req, res) {
    if (req.isAuthenticated()) {
      res.redirect("/profile/" + req._passport.session.user[0].name);
    } else {
      res.render("login", {
        errorMessage: ""
      });
    }
  })
  .post(function (req, res) {
    const username = req.body.uname;

    // Check if the user exists
    User.find({
      name: username
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length == 0) {
          res.redirect("/error/noUser");
        } else if (user.length > 0 && bcrypt.compareSync(req.body.pswd, user[0].password)) {
          req.login(user, function (err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/public");
            }
          });
        } else {
          // throw an error
          res.redirect('/error/badPswd');
          console.log("There was an error logging in. Please try again.");
        }
      }
    });
  });

// This page gets loaded when there is an error
app.get("/error/:err", function (req, res) {
  const error = req.params.err;
  if (error == "noUser") {
    res.render("login", {
      errorMessage: "No user available. Please register."
    });
  } else if (error == "badPswd") {
    res.render("login", {
      errorMessage: "Invalid password."
    });
  } else if (error == "userTaken") {
    res.render("login", {
      errorMessage: "That username was already taken."
    });
  } else if (error == "emailTaken") {
    res.render("login", {
      errorMessage: "That email was already taken."
    });
  } else if (error == "badRegister") {
    res.render("login", {
      errorMessage: "Server side error. Please report this issue."
    });
  } else if (error == "noMatch") {
    res.render("login", {
      errorMessage: "Passwords did not match."
    });
  } else if (error == "invalidEmail") {
    res.render("login", {
      errorMessage: "Email was invalid. Please use proper format."
    });
  } else if (error == "invalidPassword") {
    res.render("login", {
      errorMessage: "Password was invalid. Please use user proper format."
    });
  } else if (error == "login") {
    res.render("login", {
      errorMessage: "Please login before entering"
    });
  } else if (error == "sameGame") {
    res.render("profile", {
      gameError: "You cannot have more than one of the same game."
    });
  }
});

// Logs the user out
app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
})

// Renders public lobbies page
app.get("/public", function (req, res) {
  if (req.isAuthenticated()) {

    User.findOne({
      name: req._passport.session.user[0].name
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else if (user.requestedFriends.length == 0 && user.friends.length == 0) {
        Queue.find({
          visibility: true
        }, function (err, qs) {
          if (err) {
            console.log(err);
          } else {
            var newQs = [];
            qs.forEach(function (queue) {
              var firstId = queue.lobby[0]._id;
              var newLobby = queue.lobby;
              var counter = 0;
              newLobby.forEach(function (user) {
                User.findById(user, function (err, lobbyist) {
                  if (err) {
                    console.log(err);
                  }
                  if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                    newLobby[newLobby.indexOf(user)] = lobbyist.name;
                    var newQueue = {
                      id: queue._id,
                      game: queue.game,
                      desc: queue.description,
                      lobby: newLobby,
                      waiting: queue.waiting,
                      queueMember: queue._id == req._passport.session.user[0].currentQueue,
                      isCreator: firstId == req._passport.session.user[0]._id
                    };
                    newQs.push(newQueue);
                  } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                    newLobby[newLobby.indexOf(user)] = lobbyist.name;
                  } else if (counter == newLobby.length - 1) {
                    var newQueue = {
                      id: queue._id,
                      game: queue.game,
                      desc: queue.description,
                      lobby: newLobby,
                      waiting: queue.waiting,
                      queueMember: queue._id == req._passport.session.user[0].currentQueue,
                      isCreator: firstId == req._passport.session.user[0]._id
                    };
                    newQs.push(newQueue);
                  }
                  counter++;
                  if (newQs.length == qs.length) {
                    res.render("public", {
                      hasRequests: false,
                      hasFriends: false,
                      queues: newQs,
                    });
                  }
                })
              })
            })
          }
        });
      } else if (user.requestedFriends.length == 0 && user.friends.length > 0) {
        let firstFriendArr = [];
        user.friends.forEach(function (friendsId) {
          User.findById(friendsId, function (err, friend) {
            if (err) {
              console.log(err);
            } else {
              firstFriendArr.push({
                friendName: friend.name,
                status: friend.status
              });
              if (firstFriendArr.length == user.friends.length) {
                Queue.find({
                  visibility: true
                }, function (err, qs) {
                  if (err) {
                    console.log(err);
                  } else {
                    var newQs = [];
                    qs.forEach(function (queue) {
                      var firstId = queue.lobby[0]._id;
                      var newLobby = queue.lobby;
                      var newWaiting = queue.waiting;
                      var counter = 0;
                      newLobby.forEach(function (user) {
                        User.findById(user, function (err, lobbyist) {
                          if (err) {
                            console.log(err);
                          }
                          if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                            newLobby[newLobby.indexOf(user)] = lobbyist.name;
                            var newQueue = {
                              id: queue._id,
                              game: queue.game,
                              desc: queue.description,
                              lobby: newLobby,
                              waiting: newWaiting,
                              queueMember: queue._id == req._passport.session.user[0].currentQueue,
                              isCreator: firstId == req._passport.session.user[0]._id
                            };
                            newQs.push(newQueue);
                          } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                            newLobby[newLobby.indexOf(user)] = lobbyist.name;
                          } else if (counter == newLobby.length - 1) {
                            var newQueue = {
                              id: queue._id,
                              game: queue.game,
                              desc: queue.description,
                              lobby: newLobby,
                              waiting: newWaiting,
                              queueMember: queue._id == req._passport.session.user[0].currentQueue,
                              isCreator: firstId == req._passport.session.user[0]._id
                            };
                            newQs.push(newQueue);
                          }
                          counter++;
                          if (newQs.length == qs.length) {
                            res.render("public", {
                              hasRequests: false,
                              hasFriends: true,
                              friends: firstFriendArr,
                              queues: newQs
                            });
                            console.log("Rendered public");
                          }
                        })
                      })
                    })
                  }
                });
              }
            }
          });
        });
      } else {
        let requested = [];
        user.requestedFriends.forEach(function (foundId) {
          User.findById(foundId, function (err, found) {
            if (err) {
              console.log(err);
            } else {
              requested.push(found.name);
              if (requested.length == user.requestedFriends.length) {
                User.findOne({
                  name: req._passport.session.user[0].name
                }, function (err, main) {
                  if (err) {
                    console.log(err);
                  } else if (main.friends.length == 0) {
                    Queue.find({
                      visibility: true
                    }, function (err, qs) {
                      if (err) {
                        console.log(err);
                      } else {
                        var newQs = [];
                        qs.forEach(function (queue) {
                          var firstId = queue.lobby[0]._id;
                          var newLobby = queue.lobby;
                          var counter = 0;
                          newLobby.forEach(function (user) {
                            User.findById(user, function (err, lobbyist) {
                              if (err) {
                                console.log(err);
                              }
                              if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                                newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                var newQueue = {
                                  id: queue._id,
                                  game: queue.game,
                                  desc: queue.description,
                                  lobby: newLobby,
                                  waiting: queue.waiting,
                                  queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                  isCreator: firstId == req._passport.session.user[0]._id
                                };
                                newQs.push(newQueue);
                              } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                                newLobby[newLobby.indexOf(user)] = lobbyist.name;
                              } else if (counter == newLobby.length - 1) {
                                var newQueue = {
                                  id: queue._id,
                                  game: queue.game,
                                  desc: queue.description,
                                  lobby: newLobby,
                                  waiting: queue.waiting,
                                  queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                  isCreator: firstId == req._passport.session.user[0]._id
                                };
                                newQs.push(newQueue);
                              }
                              counter++;
                              if (newQs.length == qs.length) {
                                res.render("public", {
                                  hasRequests: true,
                                  hasFriends: false,
                                  requestedFriends: requested,
                                  queues: newQs,
                                });
                              }
                            })
                          })
                        })
                      }
                    });
                  } else {
                    let friendArr = [];
                    main.friends.forEach(function (friendId) {
                      User.findById(friendId, function (err, friend) {
                        if (err) {
                          console.log(err);
                        } else {
                          friendArr.push({
                            friendName: friend.name,
                            status: friend.status
                          });
                          if (friendArr.length == main.friends.length) {
                            Queue.find({
                              visibility: true
                            }, function (err, qs) {
                              if (err) {
                                console.log(err);
                              } else {
                                var newQs = [];
                                qs.forEach(function (queue) {
                                  var firstId = queue.lobby[0]._id;
                                  var newLobby = queue.lobby;
                                  var counter = 0;
                                  newLobby.forEach(function (user) {
                                    User.findById(user, function (err, lobbyist) {
                                      if (err) {
                                        console.log(err);
                                      }
                                      if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                                        newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                        var newQueue = {
                                          id: queue._id,
                                          game: queue.game,
                                          desc: queue.description,
                                          lobby: newLobby,
                                          waiting: queue.waiting,
                                          queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                          isCreator: firstId == req._passport.session.user[0]._id
                                        };
                                        newQs.push(newQueue);
                                      } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                                        newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                      } else if (counter == newLobby.length - 1) {
                                        var newQueue = {
                                          id: queue._id,
                                          game: queue.game,
                                          desc: queue.description,
                                          lobby: newLobby,
                                          waiting: queue.waiting,
                                          queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                          isCreator: firstId == req._passport.session.user[0]._id
                                        };
                                        newQs.push(newQueue);
                                      }
                                      counter++;
                                      if (newQs.length == qs.length) {
                                        res.render("public", {
                                          hasRequests: true,
                                          hasFriends: true,
                                          requestedFriends: requested,
                                          friends: friendArr,
                                          queues: newQs,
                                        });
                                      }
                                    })
                                  })
                                })
                              }
                            });
                          }
                        }
                      })
                    })
                  }
                });
              }
            }
          })
        })
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Renders private lobbies page
app.get("/private", function (req, res) {
  if (req.isAuthenticated()) {
    console.log("private");
    User.findOne({
      name: req._passport.session.user[0].name
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else if (user.requestedFriends.length == 0 && user.friends.length == 0) {
        res.render("private", {
          hasRequests: false,
          hasFriends: false,
          queues: [],
        });
      } else if (user.requestedFriends.length == 0 && user.friends.length > 0) {
        let firstFriendArr = [];
        user.friends.forEach(function (friendsId) {
          User.findById(friendsId, function (err, friend) {
            if (err) {
              console.log(err);
            } else {
              firstFriendArr.push(friend.name);
              if (firstFriendArr.length == user.friends.length) {
                console.log("step 1");
                var queues = [];
                var count = 0;
                for (var i = 0; i < user.friends.length; i++) {
                  User.findById(user.friends[i], function (err, foundFriend) {
                    count++;
                    if (err) {
                      console.log(err);
                    } else {
                      if (foundFriend.inQueue) {
                        Queue.findById(foundFriend.currentQueue, function (err, friendQueue) {
                          if (err) {
                            console.log(err);
                          } else {
                            if (foundFriend._id.equals(friendQueue.creator)) {
                              queues.push(friendQueue);
                            }
                            if (count == user.friends.length) {
                              console.log("step 2");
                              console.log(queues);
                              if (queues.length == 0) {
                                res.render("private", {
                                  hasRequests: false,
                                  hasFriends: true,
                                  friends: firstFriendArr,
                                  queues: [],
                                });
                              }
                              var newQs = [];
                              queues.forEach(function (queue) {
                                var firstId = queue.lobby[0]._id;
                                var newLobby = queue.lobby;
                                var counter = 0;
                                newLobby.forEach(function (user) {
                                  User.findById(user, function (err, lobbyist) {
                                    if (err) {
                                      console.log(err);
                                    }
                                    if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                                      newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                      var newQueue = {
                                        id: queue._id,
                                        game: queue.game,
                                        desc: queue.description,
                                        lobby: newLobby,
                                        waiting: queue.waiting,
                                        queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                        isCreator: firstId == req._passport.session.user[0]._id
                                      };
                                      newQs.push(newQueue);
                                    } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                                      newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                    } else if (counter == newLobby.length - 1) {
                                      var newQueue = {
                                        id: queue._id,
                                        game: queue.game,
                                        desc: queue.description,
                                        lobby: newLobby,
                                        waiting: queue.waiting,
                                        queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                        isCreator: firstId == req._passport.session.user[0]._id
                                      };
                                      newQs.push(newQueue);
                                    }
                                    counter++;
                                    if (newQs.length == queues.length) {
                                      console.log(newQs);
                                      res.render("private", {
                                        hasRequests: false,
                                        hasFriends: true,
                                        friends: firstFriendArr,
                                        queues: newQs,
                                      });
                                    }
                                  })
                                })
                              })
                            }
                          }
                        })
                      }
                    }
                  })
                }
              }
            }
          })
        })
      } else {
        let requested = [];
        user.requestedFriends.forEach(function (foundId) {
          User.findById(foundId, function (err, found) {
            if (err) {
              console.log(err);
            } else {
              requested.push(found.name);
              if (requested.length == user.requestedFriends.length) {
                User.findOne({
                  name: req._passport.session.user[0].name
                }, function (err, main) {
                  if (err) {
                    console.log(err);
                  } else if (main.friends.length == 0) {
                    res.render("private", {
                      hasRequests: true,
                      hasFriends: false,
                      requestedFriends: requested,
                      queues: [],
                    });
                  } else {
                    let friendArr = [];
                    main.friends.forEach(function (friendId) {
                      User.findById(friendId, function (err, friend) {
                        if (err) {
                          console.log(err);
                        } else {
                          friendArr.push(friend.name);
                          if (friendArr.length == main.friends.length) {
                            var queues = [];
                            var count = 0;
                            user.friends.forEach(function (friend) {
                              User.findById(friend, function (err, foundFriend) {
                                if (err) {
                                  console.log(err);
                                } else {
                                  count++;
                                  if (foundFriend.inQueue) {
                                    Queue.findById(foundFriend.currentQueue, function (err, friendQueue) {
                                      if (err) {
                                        console.log(err);
                                      } else {
                                        if (foundFriend._id.equals(friendQueue.creator)) {
                                          queues.push(friendQueue);
                                        }
                                        // Figure out how to stop the forEach here
                                        if (count == user.friends.length) {
                                          if (queues.length == 0) {
                                            res.render("private", {
                                              hasRequests: true,
                                              hasFriends: true,
                                              friends: friendArr,
                                              requestedFriends: requested,
                                              queues: [],
                                            });
                                          }
                                          var newQs = [];
                                          queues.forEach(function (queue) {
                                            var firstId = queue.lobby[0]._id;
                                            var newLobby = queue.lobby;
                                            var counter = 0;
                                            newLobby.forEach(function (user) {
                                              User.findById(user, function (err, lobbyist) {
                                                if (err) {
                                                  console.log(err);
                                                }
                                                if (newLobby.indexOf(user) == newLobby.length - 1 && lobbyist != null) {
                                                  newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                                  var newQueue = {
                                                    id: queue._id,
                                                    game: queue.game,
                                                    desc: queue.description,
                                                    lobby: newLobby,
                                                    waiting: queue.waiting,
                                                    queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                                    isCreator: firstId == req._passport.session.user[0]._id
                                                  };
                                                  newQs.push(newQueue);
                                                } else if (lobbyist != null && newLobby.indexOf(user) < newLobby.length - 1) {
                                                  newLobby[newLobby.indexOf(user)] = lobbyist.name;
                                                } else if (counter == newLobby.length - 1) {
                                                  var newQueue = {
                                                    id: queue._id,
                                                    game: queue.game,
                                                    desc: queue.description,
                                                    lobby: newLobby,
                                                    waiting: queue.waiting,
                                                    queueMember: queue._id == req._passport.session.user[0].currentQueue,
                                                    isCreator: firstId == req._passport.session.user[0]._id
                                                  };
                                                  newQs.push(newQueue);
                                                }
                                                counter++;
                                                if (newQs.length == queues.length) {
                                                  console.log(newQs);
                                                  res.render("private", {
                                                    hasRequests: true,
                                                    hasFriends: true,
                                                    requestedFriends: requested,
                                                    friends: friendArr,
                                                    queues: newQs,
                                                  });
                                                }
                                              })
                                            })
                                          })
                                        }
                                      }
                                    })
                                  }
                                }
                              })
                            })
                          }
                        }
                      })
                    })
                  }
                });
              }
            }
          })
        })
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Renders profile page
app.get("/profile", function (req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/profile/" + req._passport.session.user[0].name);
  } else {
    res.redirect("/error/login");
  }
});

// Render's a specific user's profile page
app.get("/profile/:name", function (req, res) {
  if (req.isAuthenticated()) {
    const user = req.params.name;

    User.findOne({
      name: user
    }, function (err, found) {
      if (err) {
        console.log(err);
      } else if (user == req._passport.session.user[0].name) {
        res.render("profile", {
          username: user,
          games: found.favoriteGames,
          status: found.status,
          userError: "",
          gameError: "",
          isUser: true
        });
      } else {
        res.render("profile", {
          username: user,
          games: found.favoriteGames,
          status: found.status,
          userError: "",
          gameError: "",
          isUser: false
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Registers a user if the user doesn't already exist
app.post("/register", function (req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  var password = req.body.pswd;
  var confirm = req.body.pswdConfirm;
  var games = ["No game selected", "No game selected", "No game selected"];

  // Checks if the given passwords were the same
  if (password != confirm) {
    /* reload the register page with an error in red text at the 
    top saying that the password and confirmation don't match */
    res.redirect("/error/noMatch");
    console.log("The passwords did not match.");
  }

  // Check if the email is valid
  else if (!(emailValidator.validate(email))) {
    /* return to register page, the
    email is invalid! */
    res.redirect("/error/invalidEmail");
    console.log("The given email was invalid!");
  }

  // Check if the password is valid
  else if (!(pswdSchema.validate(password))) {
    res.redirect("/error/invalidPassword");
    console.log("The given password was invalid! : " + pswdSchema.validate(password, {
      list: true
    }));
  } else {
    bcrypt.hash(password, saltRounds, function (err, hash) {
      password = hash;
    });
    // Check if the username has been taken
    User.find({
      name: username
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length > 0) {
          res.redirect("/error/userTaken");
        } else if (user.length == 0) {
          User.find({
            email: email
          }, function (err, user) {
            if (err) {
              console.log(err);
            } else {
              if (user.length > 0) {
                /* show that email has already been taken 
                maybe go to recovery page? */
                res.redirect("/error/emailTaken");
              } else if (user.length == 0) {
                const user = new User({
                  name: username,
                  password: password,
                  email: email,
                  favoriteGames: games,
                  status: "No status set"
                });

                user.save();

                setTimeout(function () {
                  User.find({
                    name: username
                  }, function (err, user) {
                    if (err) {
                      console.log(err);
                    } else {
                      if (user.length == 0) {
                        res.redirect("/error/noUser");
                      } else if (user[0].password != password) {
                        res.redirect("/error/badPswd");
                      } else if (user.length > 0 && user[0].password == password) {
                        req.login(user, function (err) {
                          if (err) {
                            console.log(err);
                          } else {
                            res.redirect("/public");
                          }
                        });
                        console.log("Successfully logged in!");
                      } else {
                        // throw an error
                        console.log("There was an error logging in. Please try again.");
                      }
                    }
                  });
                }, 3000);
              } else {
                /* throw error */
                console.log("There was an error entering your email.");
              }
            }
          });
        } else {
          /* throw error */
          console.log("There was an error entering your username.");
        }
      }
    });
  }
});

// Sends a friend request
app.post("/addFriend", function (req, res) {
  if (req.isAuthenticated()) {
    const mainUser = req._passport.session.user[0].name;
    const newFriend = req.body.friendName;

    function addFriend() {
      User.findOne({
        name: newFriend
      }, function (err, user) {
        if (err) {
          console.log(err);
        } else {
          User.findOne({
            name: mainUser
          }, function (err, requester) {
            if (err) {
              console.log(err);
            } else if (newFriend == mainUser) {
              res.redirect("/public");
            } else {
              User.findOneAndUpdate({
                name: user.name
              }, {
                $addToSet: {
                  requestedFriends: requester._id
                }
              }, {
                new: true
              }, function (err) {
                if (err) {
                  console.log(err);
                } else {
                  res.redirect("/public");
                }
              });
            }
          });
        }
      })
    }

    User.findOne({
      name: newFriend
    }, function (err, friend) {
      if (err) {
        console.log(err);
      } else if (friend == null) {
        res.redirect("/public");
      } else {
        User.findOne({
          name: mainUser
        }, function (err, userRequesting) {
          if (err) {
            console.log(err);
          } else {
            var hasUser = false;
            for (var i = 0; i < friend.friends.length; i++) {
              if (userRequesting._id == friend.friends[i]) {
                hasUser = true;
              }
            }
            if (hasUser) {
              res.redirect("/public");
            } else {
              addFriend();
            }
          }
        });
      }
    });
  } else {
    res.redirect("/error/login")
  }
});

// Allows a user to accept a friend request
app.post("/acceptFriendRequest", function (req, res) {
  if (req.isAuthenticated()) {
    var requester = req._passport.session.user[0].name;
    var newFriend = req.body.accept;
    User.findOne({
      name: requester
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        User.findOne({
          name: newFriend
        }, function (err, friend) {
          if (err) {
            console.log(err);
          } else {
            User.findOneAndUpdate({
              name: user.name
            }, {
              $addToSet: {
                friends: friend._id
              }
            }, {
              new: true
            }, function (err, oldUser) {
              if (err) {
                console.log(err);
              } else {
                User.findOneAndUpdate({
                  name: oldUser.name
                }, {
                  $pull: {
                    requestedFriends: friend._id
                  }
                }, {
                  new: true
                }, function (err) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.redirect("/public");
                  }
                });
              }
            });
            User.findOneAndUpdate({
              name: friend.name
            }, {
              $addToSet: {
                friends: user._id
              }
            }, {
              new: true
            }, function (err) {
              if (err) {
                console.log(err);
              }
            });
          }
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Allows a user to reject a friend request
app.post("/rejectFriendRequest", function (req, res) {
  if (req.isAuthenticated()) {
    var requester = req._passport.session.user[0].name;
    var newFriend = req.body.reject;
    User.findOne({
      name: requester
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        User.findOne({
          name: newFriend
        }, function (err, friend) {
          if (err) {
            console.log(err);
          } else {
            User.findOneAndUpdate({
              name: user.name
            }, {
              $pull: {
                requestedFriends: friend._id
              }
            }, {
              new: true
            }, function (err) {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/public");
              }
            });
          }
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Render email recovery page
app.post("/recover", function (req, res) {
  const email = req.body.email;

  console.log(email);
});

// Filter public lobbies
app.post("/filter", function (req, res) {
  const game = req.body.filterGame;
  const full = req.body.full;

  Queue.find({
    game: game,
    full: full
  }, function (err, queue) {
    if (err) {
      console.log(err);
    } else {
      /* only prints the filtered queues to the 
      console for now, later Alex will have to 
      put it into the page */
      console.log(queue);
    }
  });

  res.redirect("/public");
});

// Allows the user to decide if they want to make a public or private queue
app.post("/create", function (req, res) {
  const avai = req.body.availability;
  if (avai == "open") {
    res.redirect("/publicCreate");
  } else if (avai == "friends") {
    res.redirect("/privateCreate");
  }
});

// Creates a public queue
app.post("/publicCreate", function (req, res) {
  if (req.isAuthenticated()) {

    if (req._passport.session.user[0].inQueue) {
      res.redirect("/public");
    } else {
      const game = req.body.game;
      const desc = req.body.desc;
      const num = req.body.slots;
      const visibility = true;
      var lobby = [req._passport.session.user[0]._id];
      var isFull = true;


      for (var i = lobby.length; i <= num; i++) {
        lobby.push(null);
      }

      for (var i = 0; i < lobby.length; i++) {
        if (lobby[i] == null) {
          isFull = false;
        }
      }

      // Create a new queue object with the given properties
      const queue = new Queue({
        game: game,
        description: desc,
        visibility: visibility,
        lobby: lobby,
        full: isFull,
        creator: req._passport.session.user[0]._id
      });

      // Save the queue to the DB
      queue.save();

      setTimeout(function () {
        Queue.findOne({
          creator: req._passport.session.user[0]._id
        }, function (err, q) {
          if (err) {
            console.log(err);
          }
          User.findByIdAndUpdate(req._passport.session.user[0]._id, {
            $set: {
              inQueue: true,
              currentQueue: q._id
            }
          }, {
            new: true
          }, function (err) {
            if (err) {
              console.log(err);
            }
            req._passport.session.user[0].inQueue = true;
            req._passport.session.user[0].currentQueue = q._id;
            res.redirect("/public");
          });
        });
      }, 1000);
    }

  } else {
    res.redirect("/error/login");
  }
});

// Creates a private queue
app.post("/privateCreate", function (req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  //REMOVE req.body.availibility FROM THE CODE!!!!!
  const num = req.body.slots;
  const visibility = false;
  /* Alex will have to pass an array through
  from the html site to this js l0l  */
  //const reserved = req.body.reserved;
  var lobby = [];
  var isFull = true;

  if (reserved.length() >= num) {
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  for (var i = 0; i < reserved; i++) {
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++) {
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i < lobby.length(); i++) {
    if (lobby[i] == null) {
      isFull = false;
    }
  }

  // Create a new queue object with the given properties
  const queue = new Queue({
    game: game,
    description: desc,
    visibility: visibility,
    lobby: lobby,
    full: isFull
  });

  // Save the queue to the DB
  queue.save();

  console.log(game + ", " + desc + ", " + avail + ", " + num + "," + visibility);
  res.redirect("/private");
});

// Allows the user to join a queue
app.post("/joinQueue", function (req, res) {
  if (req.isAuthenticated()) {
    var joiningQueue = req.body.joinID;
    var user = req._passport.session.user[0]._id;
    var newLobby = [];

    User.findById(user, function (err, found) {
      if (found.inQueue) {
        res.redirect("/public");
      } else {
        Queue.findById(joiningQueue, function (err, queue) {
          if (err) {
            console.log(err);
          }
          var length = queue.lobby.length
          for (var i = 0; i < queue.lobby.length; i++) {
            if (queue.lobby[i] != null) {
              newLobby[i] = queue.lobby[i];
            }
          }
          if (newLobby.length == length) {
            var avai = queue.visibility;
            if (avai) {
              res.redirect("/public");
            } else {
              res.redirect("/private");
            }
          } else {
            Queue.findByIdAndUpdate(joiningQueue, {
              lobby: newLobby
            }, {
              new: true
            }, function (err, queue) {
              if (err) {
                console.log(err);
              }
              Queue.findByIdAndUpdate(joiningQueue, {
                $addToSet: {
                  lobby: user
                }
              }, {
                new: true
              }, function (err, queue) {
                if (err) {
                  console.log(err);
                }
                var finalLobby = queue.lobby;
                for (var j = queue.lobby.length; j < length; j++) {
                  finalLobby.push(null);
                }
                Queue.findByIdAndUpdate(joiningQueue, {
                  lobby: finalLobby
                }, {
                  new: true
                }, function (err) {
                  User.findByIdAndUpdate(user, {
                    $set: {
                      inQueue: true,
                      currentQueue: joiningQueue
                    }
                  }, {
                    new: true
                  }, function (err) {
                    req._passport.session.user[0].inQueue = true;
                    req._passport.session.user[0].currentQueue = joiningQueue;
                    var avai = queue.visibility;
                    if (avai) {
                      res.redirect("/public");
                    } else {
                      res.redirect("/private");
                    }
                  });
                });
              });
            });
          }
        })
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Allows the user to leave a queue
app.post("/leaveQueue", function (req, res) {
  if (req.isAuthenticated()) {
    var currentQueue = req.body.leaveID;
    var requestingUser = req._passport.session.user[0]._id;

    Queue.findById(currentQueue, function (err, queue) {
      if (err) {
        console.log(err);
      }
      if (queue.creator == requestingUser) {
        Queue.findByIdAndRemove(currentQueue, function (err, q) {
          if (err) {
            console.log(err);
          } else {
            q.lobby.forEach(function (user) {
              User.findByIdAndUpdate(user, {
                $set: {
                  inQueue: false,
                  currentQueue: null
                }
              }, {
                new: true
              }, function (err) {
                if (err) {
                  console.log(err);
                }
              })
            })
            req._passport.session.user[0].inQueue = false;
            req._passport.session.user[0].currentQueue = null;
            res.redirect("/public");
          }
        });
      } else {
        User.findById(requestingUser, function (err, found) {
          if (err) {
            console.log(err);
          }
          if (queue.waiting.includes(found.name)) {
            Queue.findByIdAndUpdate(currentQueue, {
              $pull: {
                waiting: found.name
              }
            }, function (err) {
              if (err) {
                console.log(err);
              }
              User.findOneAndUpdate({
                name: found.name
              }, {
                $set: {
                  inQueue: false,
                  currentQueue: null
                }
              }, {
                new: true
              }, function (err) {
                if (err) {
                  console.log(err);
                }
                req._passport.session.user[0].inQueue = false;
                req._passport.session.user[0].currentQueue = null;
                res.redirect("/public");
              });
            });
          } else {
            var newLobby = queue.lobby;
            for (var i = 0; i < newLobby.length; i++) {
              if (newLobby[i] == requestingUser) {
                newLobby[i] = null;
                break;
              }
            }
            Queue.findByIdAndUpdate(currentQueue, {
              $set: {
                lobby: newLobby
              }
            }, {
              new: true
            }, function (err) {
              if (err) {
                log
              }
              if (err) {
                console.log(err);
              } else {
                User.findByIdAndUpdate(requestingUser, {
                  $set: {
                    inQueue: false,
                    currentQueue: null
                  }
                }, {
                  new: true
                }, function (err) {
                  if (err) {
                    console.log(err);
                  } else {
                    req._passport.session.user[0].inQueue = false;
                    req._passport.session.user[0].currentQueue = null;
                    res.redirect("/public");
                  }
                });
              }
            })
          }
        })
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Deletes a queue
app.post("/deleteQueue", function (req, res) {
  if (req.isAuthenticated()) {
    const id = req.body.id;
    Queue.findByIdAndRemove(id, function (err, q) {
      if (err) {
        console.log(err);
      } else {
        q.lobby.forEach(function (user) {
          User.findByIdAndUpdate(user, {
            $set: {
              inQueue: false,
              currentQueue: null
            }
          }, {
            new: true
          }, function (err) {
            if (err) {
              console.log(err);
            }
          })
        })
        res.redirect("/public");
      }
    });
  } else {
    res.redirect("/error/login");
  }

});

// Allows the user to join a wait queue
app.post("/joinWaiting", function (req, res) {
  if (req.isAuthenticated()) {
    var waitingID = req.body.waitingID;
    var user = req._passport.session.user[0]._id;

    User.findById(user, function (err, found) {
      if (found.inQueue) {
        res.redirect("/public");
      } else {
        Queue.findById(waitingID, function (err, waitingQueue) {
          if (err) {
            console.log(err);
          }
          var length = waitingQueue.waiting.length
          if (length != 5) {
            /* If this isn't the way to add 
            someone to the waiting array, change 
            it. This is probably bugged. */
            Queue.findByIdAndUpdate(waitingID, {
              $addToSet: {
                waiting: found.name
              }
            }, function (err) {
              if (err) {
                console.log(err);
              }
              User.findByIdAndUpdate(user, {
                $set: {
                  inQueue: true,
                  currentQueue: waitingID
                }
              }, {
                new: true
              }, function (err) {
                req._passport.session.user[0].inQueue = true;
                req._passport.session.user[0].currentQueue = waitingID;
                var avai = waitingQueue.visibility;
                if (avai) {
                  res.redirect("/public");
                } else {
                  res.redirect("/private");
                }
              });
            })

          } else {
            res.redirect("/public");
            console.log("Waiting full");
          }
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Allows the user to edit username
app.post("/userEdit", function (req, res) {
  /* Enter old username */
  const oldUsername = req.body.oldUsername;
  const newUsername = req.body.newUsername
  const confirm = req.body.confirmUsername;

  if (newUsername != confirm) {
    res.render("profile", {
      username: req._passport.session.user[0].name,
      email: req._passport.session.user[0].email,
      games: req._passport.session.user[0].favoriteGames,
      userError: "Usernames didn't match",
      gameError: "",
      isUser: true
    });
  } else if (oldUsername != req._passport.session.user[0].name) {
    res.render("profile", {
      username: req._passport.session.user[0].name,
      email: req._passport.session.user[0].email,
      games: req._passport.session.user[0].favoriteGames,
      userError: "Usernames didn't match",
      gameError: "",
      isUser: true
    });
  } else {
    User.find({
      name: newUsername
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length > 0) {
          res.render("profile", {
            username: req._passport.session.user[0].name,
            email: req._passport.session.user[0].email,
            games: req._passport.session.user[0].favoriteGames,
            userError: "Username is already taken",
            gameError: "",
            isUser: true
          });
        } else {
          User.findOneAndUpdate({
            name: oldUsername
          }, {
            name: newUsername
          }, {
            new: true
          }, function () {
            req._passport.session.user[0].name = newUsername;
            res.redirect("profile/" + newUsername);
          });
        }
      }
    });
  }
});


// Allows the user to edit their 3 favorite games
app.post("/statusEdit", function (req, res) {
  if (req.isAuthenticated()) {
    const user = req._passport.session.user[0].name;
    const newStatus = req.body.newStatus;

    User.findOneAndUpdate({
      name: user
    }, {
      $set: {
        status: newStatus
      }
    }, function (err) {
      if (err) {
        console.log(err);
      }
    });

    res.redirect("/profile");
  } else {
    res.redirect("/error/login");
  }
});

// Edit 3 favorite games on profile
app.post("/gameEdit", function (req, res) {
  /* Enter current username */
  const user = req._passport.session.user[0].name;
  const game1 = req.body.newGame1;
  const game2 = req.body.newGame2;
  const game3 = req.body.newGame3;

  if (game1 == game2 || game1 == game3 || game2 == game3) {
    console.log("You cannot have more than one of the same favorite game.");
    res.redirect("/error/sameGame");
  } else {
    const gameArr = [game1, game2, game3];

    // Updates the user's three favorite games
    User.findOneAndUpdate({
      name: user
    }, {
      favoriteGames: gameArr
    }, {
      new: true
    }, function () {
      req._passport.session.user[0].favoriteGames = gameArr;
      res.redirect("profile/" + user);
    });
  }


});

// Connects to the site
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
  console.log("Server started on the port " + port);
});
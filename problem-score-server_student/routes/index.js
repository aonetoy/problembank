var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.status(200).json({
    login: req.session.login,
    username: req.session.username,
    authority: req.session.authority,
    page: 'main-page-hello'
  })
});

module.exports = router;

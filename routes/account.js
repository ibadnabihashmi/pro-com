var _ = require('lodash');
var async = require('async');
var User = require('../models/User');
var express = require('express');
var router = express.Router();


function render(req,res){
    res.render('WH', {
        title: 'profile'
    });
}
router.get('/',render);
router.get('/profile', render);
router.get('/shop', render);
router.get('/masterpiece',render);
router.get('/managers',render);
router.get('/managers/addItem',render);

module.exports = router;
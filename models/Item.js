var mongoose = require('mongoose');

var itemSchema = new mongoose.Schema({
    name : {type:String},
    Category : {type:String},
    price : {type : Numebr},
    start : {type:Date},
    end : {type:Date},
    bidders :[
        {
            user: {type:mongoose.Schema.Types.ObjectId},
            bid: {type:Number}
        }
    ]
});



module.exports = mongoose.model('Item', itemSchemaSchema);

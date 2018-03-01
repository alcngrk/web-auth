const users = require('./users');
//const products = require('./products');

function Model(db) {
  this.users = new users.Users(db);
  //this.products = new products.Products(db);
}


module.exports = {
  Model: Model
};

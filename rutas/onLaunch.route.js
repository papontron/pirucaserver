const {verifyOrigin} = require("../middlewares/verifyOrigin");
const mongoose = require("mongoose");
const Tienda = mongoose.model('tiendas');
const Producto = mongoose.model('productos');
module.exports = (app)=>{
  app.get("/api/get_initial_data",verifyOrigin,async(req,res)=>{
    console.log("sendind initial values");
    try{
      const tiendas = await Tienda.find({});
      const productos = await Producto.find({});
      res.send({
        mensaje:"success",
        tiendas,
        productos
      })
    }catch(e){
      res.send({
        mensaje:e.message
      })
    }
  })
}
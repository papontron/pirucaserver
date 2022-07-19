const { verifyOrigin } = require("../middlewares/verifyOrigin")
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const mongoose = require("mongoose");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");

module.exports = (app)=>{
  //fetch tiendas y prodcutos ahora lo haremos al logear
  app.post("/api/dashboard",verifyOrigin, verifyCredentials,async (req,res)=>{
    console.log("from dashboard")
    try{  
      const tiendas = await Tienda.find({_user:req.user.id});
      const productos = await Producto.find({_user:req.user.id})
      //enviamos todas las tiendas y todos los productos pertenecientes al usuario
      if(tiendas){
       return res.send({
         mensaje:"success",
         tiendas,
         productos,
         token:req.user.token,
         refreshToken:req.user.refreshToken
        });
      }else{
        return res.send({
          mensaje:"Ud. aún no tiene tiendas abiertas",
          token:req.user.token,
          refreshToken:req.user.refreshToken
        });
      }
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }
  })
}
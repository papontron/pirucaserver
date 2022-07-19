const mongoose = require("mongoose");
const Tienda = mongoose.model("tiendas");
const User = mongoose.model("users");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
module.exports = (app)=>{
  //

  app.post("/api/check_user_profile",async (req,res)=>{
    const {userId} = req.body;
    try{
      const user = await User.findOne({_id:userId});
      if(!user){
        return res.send({
          mensaje:"el usuario no existe",
        })
      }else{
        return res.send({
          mensaje:"success",
          user:user,
        })
      }
    }catch(e){
      res.send({
        mensaje:e.message
      })
    }
  })

  app.post("/api/user_profile",verifyOrigin, verifyCredentials, async (req,res)=>{
    try{
      const {email,nombres,apellidos,easyCredits} = req.user;
      const tiendas = await Tienda.find({_user:req.user.id});
      res.send({mensaje:"success",email,nombres,apellidos,easyCredits,tiendas})
    }catch(err){
      return res.send({mensaje:err.message})
    } 
  })
  app.post("/api/update_perfil",verifyOrigin,verifyCredentials,async (req,res)=>{
    try{
      const user = req.user;
      const {nombres,direccion,apellidos,telefono} = req.body;
      if(!nombres||!direccion||!apellidos||!telefono){
        return res.send({
          mensaje:"no pueden haber campos en blanco",
          token:user.token,
          refreshToken:user.refreshToken
        })
      }
      user.nombres = nombres;
      user.direccion=direccion;
      user.apellidos=apellidos;
      user.telefono=telefono;
      const updatedUser = await user.save();
      if(updatedUser){
        return res.send({
          mensaje:"success",
          token:user.token,
          refreshToken:user.refreshToken,
      })
      }else{
        return res.send({
          mensaje:"no se pudo realizar la operacion",
          token:user.token,
          refreshToken:user.refreshToken
        });
      }    
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
    }
  });
}
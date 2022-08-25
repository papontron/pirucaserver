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
      const user = await User.findOne({_id:userId}).select("nombres apellidos telefono direccion rating clientes");
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
  });

  app.post("/api/update_vendedor_rating",verifyOrigin,verifyCredentials, async( req,res)=>{
    const {user} = req;
    const {_vendedor,rating} = req.body;
    
    const {token,refreshToken} = user;
    console.log({_vendedor,rating,token,refreshToken})
    try{     
      const vendedor = await User.findOne({_id:_vendedor}).select("nombres apellidos telefono direccion rating clientes");
      const existingRating = vendedor.rating.filter(valoracion=>{
        const {_user} = valoracion;
        return _user.toString() === user._id.toString();
      });

      if(existingRating.length>0){
        vendedor.rating.forEach(valoracion=>{
          if(valoracion._user.toString() === user._id.toString()){
            valoracion.rating = rating;
          }
        })
      }else{
        vendedor.rating.push({_user:user._id,rating});
      }
      await vendedor.save();
      return res.send({mensaje:"success",user:vendedor,token,refreshToken});
    }catch(e){
      console.log(e.message);
      res.send({mensaje:e.message, token,refreshToken});
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
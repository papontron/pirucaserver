const mongoose = require("mongoose");
const Tienda = mongoose.model("tiendas");
const User = mongoose.model("users");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
module.exports = (app)=>{
  //

  app.post("/api/check_user_profile",verifyOrigin,verifyCredentials,async (req,res)=>{
    /*
    aqui enviamnos:
      avarage rating de la persona 
      el rating del cliente a la persona
      la info de la persona
    */
    const {userId} = req.body;
    const {token, refreshToken} = req.user;
    let isCliente = false;
    try{
      const userProfile = await User.findOne({
        _id:userId
      }).select("nombres apellidos telefono direccion rating clientes");

  
      if(!userProfile){
        return res.send({
          mensaje:"el usuario no existe",
          token,
          refreshToken,
        })
      }else{

        if(userProfile.clientes.includes(req.user._id.toString())){
          isCliente = true;
        }else{
          return res.send({
            mensaje:"success",
            token,
            refreshToken
          })
        }
        
        const totalRating = userProfile.rating.reduce((p,c)=>p+c.rating,0);//cambiar por $project
        // const averageRating=User.aggregate([
        //   {$match:{_id:userId}},
        //   {$unwind:"$rating"},
        //   {$avg:{}}
        // ]);
        
        const averageRating = (totalRating)/userProfile.rating.length;
        console.log({totalRating});
        console.log({averageRating});
  
        const clientRating = userProfile.rating.filter(rate=>{
          return rate._user.toString() === req.user._id.toString();
        });
        
        console.log({clientRating})
        console.log(clientRating[0].rating)
        return res.send({
          mensaje:"success",
          token,
          refreshToken,
          isCliente,
          clientRating:clientRating[0].rating,
          averageRating,
          totalRatings:userProfile.rating.length,
          user:{
            nombres:userProfile.nombres,
            apellidos:userProfile.apellidos,
            telefono:userProfile.telefono,
            direccion:userProfile.direccion,
          }
        })
      }
    }catch(e){
      console.log(e);
      res.send({
        mensaje:e.message,
        token,
        refreshToken
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
      const userProfile = await vendedor.save();
      const totalRating = userProfile.rating.reduce((p,c)=>p+c.rating,0);
      const averageRating = (totalRating)/userProfile.rating.length;

      return res.send({
        mensaje:"success",
        token,
        refreshToken,
        isCliente:true,
        clientRating:rating,
        averageRating,
        totalRatings:userProfile.rating.length,
        user:{
          nombres:userProfile.nombres,
          apellidos:userProfile.apellidos,
          telefono:userProfile.telefono,
          direccion:userProfile.direccion,
        }
      })
    }catch(e){
      console.log(e);
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
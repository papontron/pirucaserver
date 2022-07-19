const {verifyOrigin} = require("../middlewares/verifyOrigin");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const mongoose = require("mongoose");
const Buzon = mongoose.model("buzones");

module.exports = (app) =>{

  app.post("/api/mensajes/read",verifyOrigin,verifyCredentials, async(req,res)=>{
    try{
      await Buzon.updateOne(
        {
          _user:req.user.id,
           mensajes:{$elemMatch:{_id:req.body.mensajeId}}
        },
        {$set:{"mensajes.$.nuevo":false}});
      res.send({
        mensaje:"success",
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }catch(e){
      res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }  
  });

  app.post("/api/get_buzon",verifyOrigin,verifyCredentials, async (req,res)=>{
    const user = req.user;
    try{
      const buzon = await Buzon.findOne({_user:user._id});
      if(!buzon){
        return res.send({
          mensaje:"success",
          token:user.token,
          refreshToken:user.refreshToken,
          mensajes:[]
        })
      }
      return res.send({
        mensaje:"success",
        token:user.token,
        refreshToken:user.refreshToken,
        mensajes:buzon.mensajes
      })
    }catch(e){
      res.send({
        mensaje:e.message,
        token:user.token,
        refreshToken:user.refreshToken
      })
    }
  })
};
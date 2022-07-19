const mongoose = require("mongoose");
const Courier = mongoose.model("couriers");

exports.verifyCourier = async (req,res,next)=>{
  if(req.user.pirula!=="courier"){
    return res.send({
      mensaje:"no estas autorizado",
      token:req.user.token,
      refreshToken:req.user.refreshToken
    })  
  }else{
    const courier = await Courier.find({_id:req.user._courier,email:req.user.email});
    if(!courier){
      return res.send({
        mensaje:"no estas autorizado",
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }else{
      next();
    }
  }
}
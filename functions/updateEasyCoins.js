const mongoose = require("mongoose");
const User = mongoose.model("users");
const io = require("../io").getIo();
exports.updateCoinsAndNotificate= async (userId,monto)=>{
  try{
    //console.log("actualizando los easy coins de:",{userId,monto});
    await User.findOneAndUpdate({_id:userId},{$inc:{easyCoins:Number(monto)}});
    //console.log({response});
    io.in(userId.toString()).emit("updatecoins",Number(monto));
    return true;
  }catch(e){
    console.log("error actualizando los easycoins del usuario");
    return false;
  }  
}
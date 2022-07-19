const mongoose = require("mongoose");
const Buzon = mongoose.model("buzones");
const io = require("../io").getIo();
exports.sendMensajeAndNotification = async (userId,mensaje)=>{
  try{
    const buzon = await Buzon.findOne({_user:userId});
    if(!buzon){
      await new Buzon({
        _user:userId,
        mensajes:[mensaje]
      }).save();
    }else{
      await Buzon.updateOne({_user:userId},{$push:{mensajes:mensaje}})
    }
    io.in(userId.toString()).emit("nuevomensaje",mensaje);
    return {mensaje:"mensaje y notificacion enviados",response:true};
  }catch(e){
    return {mensaje:e.message,response:false};
  }
}
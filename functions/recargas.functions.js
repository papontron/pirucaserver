const io = require("../io").getIo();
const mongoose = require("mongoose");
const {updateCoinsAndNotificate} = require("../functions/updateEasyCoins");
const HistorialRecarga = mongoose.model("historialrecargas");
const Movimiento = mongoose.model("movimientos");

exports.actualizarRecargaPendienteAndNotificate = async (userId,recargaId,monto,estado)=>{
  try{
    const fecha = new Date();
    await HistorialRecarga.findOneAndUpdate({
        _user:userId,
        recargas:{$elemMatch:{_id:recargaId}}
      },
      {$set:{"recargas.$.estado":estado}
    });
    if(estado==="aprobado"){
      //incrementamos los coins del usuario
      await updateCoinsAndNotificate(userId,monto);
      //pusheamos al historial de movimientos del usuario
      console.log("aqui112");
      const newMovimiento = {
        tipo:"recarga",
        _recibo:recargaId
      }
      const movimiento = await Movimiento.findOne({_user:userId});
      if(!movimiento){
        await new Movimiento({
          _user:userId,
          movimientos:[newMovimiento]
        }).save();
        io.in(userId.toString()).emit("movimientosagregar",newMovimiento);
      }else{
        movimiento.movimientos.push(newMovimiento);
        await movimiento.save();
        io.in(userId.toString()).emit("movimientosagregar",newMovimiento);
      }      
    }
    console.log("aqui1133");
    io.in(userId.toString()).emit("recargaupdate",{userId,recargaId,estado});
    io.in("admins").emit("recargaspendientesupdate",{userId,recargaId,estado});
    return true;
  }catch(e){
    console.log("error actualizando la recarga pendiente");
    return false
  }
}

exports.getRecargasPendientes= async () =>{
  try{
    const historialRecargas = await HistorialRecarga.aggregate([
      {$unwind:"$recargas"},
      {$match:{"recargas.estado":"pendiente"}},
      { $lookup: {from: 'users', localField: '_user', foreignField: '_id', as: 'user'}}
    ]);

    const recargasPendientes = historialRecargas.map(element=>{
      console.log({element})
      const [user] = element.user;
      const {recargas:recarga} = element;
      const result = {
        _user:element._user,
        recargaId:recarga._id,
        nombres:user.nombres,
        apellidos:user.apellidos,
        fecha:recarga.fecha,
        metodoPago:recarga.metodoPago,
        monto:recarga.monto,
        estado:recarga.estado,
        capturaPago:recarga.capturaPago       
      }
      return result;
    })
    return recargasPendientes;
  }catch(e){
    console.log("error fetching recargas pendientes");
    return false;
  }
}
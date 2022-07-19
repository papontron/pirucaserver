const crypto = require("crypto");
const mongoose = require("mongoose");
const { verifyCredentials } = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const io = require("../io").getIo();
const HistorialRecarga = mongoose.model("historialrecargas");
const {sendMensajeAndNotification} = require("../functions/mensajes.functions");

module.exports = (app)=>{

  app.post("/api/historialrecargas",verifyOrigin,verifyCredentials, async(req,res)=>{
    try{
      const user = req.user;
      const historialRecargas = await HistorialRecarga.findOne({_user:user._id});
      if(!historialRecargas){
        return res.send({
          mensaje:"usted aún no ha realizado ninguna recarga",
          token:user.token,
          refreshToken:user.refreshToken
        })
      }
      res.send({
        mensaje:"success",
        historialRecargas:historialRecargas.recargas,
        token:user.token,
        refreshToken:user.refreshToken
      })
    }catch(e){
      res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken});
    }
  })

  app.post("/api/recargarcoins",verifyOrigin,verifyCredentials,async (req,res)=>{
    try{
      //generamos el recibo
      const user = req.user;
      const fecha = new Date();
      const {metodoPago,capturaPago,monto,} = req.body;
      if(!metodoPago||!capturaPago||!monto) return res.send({
        mensaje:"debe llenar todos los campos",
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
      const codigoTrans = crypto.randomBytes(24).toString('hex');
      const recarga = {
        _id: new mongoose.Types.ObjectId,
        capturaPago,
        metodoPago,
        monto,
        codigoTrans,
        fecha,
        estado:"pendiente",
      }
      const historialRecarga = await HistorialRecarga.findOne({_user:user._id});
      console.log({historialRecarga})
      if(!historialRecarga){
        console.log("creando un nuevo historial para el usuario")
        //!creamos un historial si aun no existe
        const newHistorialRecarga =  new HistorialRecarga({
          _id:new mongoose.Types.ObjectId,
          _user:user._id,
          recargas:[recarga]
        });
        await newHistorialRecarga.save();
        io.in("admins").emit("nuevarecargapendiente",{
          _user:user._id,
          recargaId:recarga._id,
          nombres:user.nombres,
          apellidos:user.apellidos,
          fecha:recarga.fecha,
          metodoPago:recarga.metodoPago,
          monto:recarga.monto,
          estado:recarga.estado,
          capturaPago:recarga.capturaPago  
        });
      }else{
        console.log("actualizando el historial de recargas del usuario")
        historialRecarga.recargas.push(recarga);
        await historialRecarga.save();
        io.in("admins").emit("nuevarecargapendiente",{
          _user:user._id,
          recargaId:recarga._id,
          nombres:user.nombres,
          apellidos:user.apellidos,
          fecha:recarga.fecha,
          metodoPago:recarga.metodoPago,
          monto:recarga.monto,
          estado:recarga.estado,
          capturaPago:recarga.capturaPago  
        });  
      }
      console.log("aqui1")
      io.in(user._id.toString()).emit("nuevarecarga",recarga);
      
      //enviamos un mensaje a la bandeja de entrada del usuario
      //con los detalles de la compra y su estado "pendiente" hasta que 
      //se confirme la transferencia y se actualizen los creditos del usuario
      const mensaje = {
        _id: new mongoose.Types.ObjectId,
        asunto:"recarga",
        contenido:`Su recarga se está procesando, espere a que se confirme su pago. Este proceso puede tardar entre 5 y 20 minutos. Su codigo de compra es: ${codigoTrans}`,
        fecha,
        nuevo:true,
        keys:{tipo:"recarga",ticket:codigoTrans}
      }
      // const buzon = await Buzon.findOne({_user:user._id});
      // if(!buzon){
      //   await new Buzon({
      //     _user:user._id,
      //     mensajes:[mensaje]
      //   })
      // }else{
      //   await Buzon.updateOne({_user:user._id},{$push:{mensajes:mensaje}})
      // }
      // console.log("se recargo exitosamnete");
      // io.in(user._id.toString()).emit("nuevomensaje",mensaje);
      const q = await sendMensajeAndNotification(user._id,mensaje);
      console.log({q})
      return res.send({
        mensaje:"success",
        token:user.token,
        refreshToken:user.refreshToken
      });
    }catch(e){
      console.log({error:e.message})
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
    }  
  })
}
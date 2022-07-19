const { verifyCredentials } = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const mongoose = require("mongoose");
const {updateCoinsAndNotificate} = require("../functions/updateEasyCoins");
const HistorialVenta = mongoose.model("historialventas");
const HistorialCompra = mongoose.model("historialcompras");
const Recibo = mongoose.model("recibos");
const io = require("../io").getIo();
const User = mongoose.model("users");
const Courier = mongoose.model("couriers");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");

module.exports = (app)=>{
  
  app.post("/api/update_estado_venta",verifyOrigin,verifyCredentials, async(req,res)=>{
    const {_recibo,_ventaId,estado,montoVenta} = req.body;
    const token=req.user.token;
    const refreshToken=req.user.refreshToken;

    switch(estado){
      case "iniciado":
        //!actualizar la venta correspondiente dentro del recibo
        Recibo.findOneAndUpdate({_id:_recibo,venta:{$elemMatch:{_id:_ventaId,estado:"pendiente"}}},
          {$set:{"venta.$.estado":estado}},
          {new:true},
          async (err,doc)=>{
            console.log({reciboActualizado:doc})
          if(err){
            return res.send({mensaje:"no se pudo actualizar el estado de la venta en el recibo",token,refreshToken})
          }else{
            if(!doc){
              console.log("el estado ya está expiradoooo");
              return res.send({mensaje:"el estado está expirado",token,refreshToken})
            } 
            //!si el estado del recibo aun era pendiente se cambia a iniciado
            if(doc&&doc.estado==="pendiente"){
              //si es estado aun es pendiente actualizamos el estado del mismo recibo a iniciado
              Recibo.findOneAndUpdate({_id:_recibo},
              {$set:{estado:estado}},
              {new:true},
              (err,doc)=>{
                if(err){
                  return res.send({mensaje:"no se pudo actualizar el estado del recibo",token,refreshToken})
                }else{
                  //ahora pasamos a actualizar el estado de la compra del comprador a iniciado(si esq aun es pendiente)
                  // si el estado del recibo era pendiente, entonces está garantizado que la compra tambien debe estar como pendiente
                  HistorialCompra.findOneAndUpdate({
                    _user:doc._comprador,
                    compras:{$elemMatch:{_recibo,estado:"pendiente"}}
                  },
                  {$set:{"compras.$.estado":estado}},
                  {new:true},
                  (err,doc)=>{
                    if(err){
                      return res.send({mensaje:"no se pudo actualizar el estado en el historial de compras",token,refreshToken})
                    }
                    //!enviamos la ntoficacion al comprador que el estado de su recibo a sido actualizado
                    io.in(doc._user.toString()).emit("compraupdate",{_recibo,estado,devolucion:null})
                  })
                }
              });
            }
            //*buscamos la venta a actualizar
            const ventaToUpdate = await HistorialVenta.aggregate([
              {
                $unwind:"$ventas"
              },
              {
                $match:{
                  _user:req.user._id,
                  "ventas._recibo":mongoose.Types.ObjectId.createFromHexString(_recibo),
                  "ventas.estado":"pendiente"
                }
              }
            ]);
            if(ventaToUpdate.length>0){
              // console.log({ventaToUpdate});
              // console.log({venta:ventaToUpdate[0].ventas})
              const {_courier,tiendas,createdAt,_comprador} = ventaToUpdate[0].ventas;
              const vendedor = await User.findOne({_id:req.user._id}).select("nombres apellidos coordenadas telefono");
              const comprador = await User.findOne({_id:_comprador}).select("nombres apellidos coordenadas telefono");
              const courier = await Courier.findOne({_id:_courier}).select("nombres apellidos");
              const {_id:_courierId} = await User.findOne({_courier}).select("_id");

              const newTiendas = await Promise.all(tiendas.map(async tienda=>{
                const tiendaInfo = await Tienda.findOne({_id:tienda._tienda}).select("coordenadas direccion nombre telefono");
                const {productos} = tienda;
                const productos2 = await Promise.all(productos.map(async producto=>{
                  const {_producto} = producto;
                  const {nombre,descripcion} = await Producto.findOne({_id:_producto}).select("nombre descripcion");
                  return {...producto,nombre,descripcion}
                }))
                return {estado:tienda.estado,productos:productos2,tiendaInfo};
              }))
              //*actualizamos el estado en el historial de ventas del vendedor               
              HistorialVenta.findOneAndUpdate({
                _user:req.user._id,
                ventas:{$elemMatch:{_recibo,estado:"pendiente"}}},
                {$set:{"ventas.$.estado":estado}},
                {new:true},
                (err,doc)=>{
                if(err){
                  return res.send({mensaje:"se actualizaron los estados del recibo pero no de la venta",token,refreshToken});
                }else{
                  //!notificaciones:
                  //!courier
                  // console.log({comprador,vendedor,courier});
                  // console.log("enviando las notificaciones luego de la aactualizacion");
                  // console.log({_courierId});
                  io.in(_courierId.toString()).emit("nuevaentregainiciada",{comprador,estado,fecha:createdAt,tiendas:newTiendas,vendedor,_courier,_recibo,_ventaId});
                  //admin
                  io.in("admins").emit("nuevaventainiciada",{comprador,courier,fecha:createdAt,tiendas:newTiendas,vendedor,_recibo,_ventaId});
                  //vendedor
                  io.in(req.user._id.toString()).emit("ventaupdate",{_recibo,estado,devolucion:null});
                  return res.send({
                    mensaje:"success",
                    token:req.user.token,
                    refreshToken:req.user.refreshToken
                  });   
                }}
              );  
            }       
          }     
        });
        break;
      case "cancelado":
      //!empezamos por actualizar el recibo
        //*actualizamos el estado de la venta en el recibo, solo si está pendiente (podria estar como expirado)

        Recibo.findOneAndUpdate(
          {
            _id:_recibo,
            venta:{$elemMatch:{_id:_ventaId,estado:"pendiente"}}
          },
          {
            $set:{"venta.$.estado":estado}
          },
          {new:true},
          async (err,reciboDoc)=>{
          if(err) return res.send({mensaje:"no se pudo actualizar el estado de tu venta",token,refreshToken});
          if(!reciboDoc){
            console.log("el estado ya está expirado");
            return res.send({mensaje:"el estado está expirado",token,refreshToken})
          } 
          //*si solo contiene una venta, actualizamos el estado total del RECIBO a cancelado y actualizamos su devolucion correspondiente
          //!correcion: como estabamos buscando con elemMatch, el resultado siempre será solo para la venta
          if(reciboDoc){


            if(reciboDoc.venta.length===1){
              //!actualizamos el estado total del recibo a cancelado y la compra a cancelado
              const foundRecibo = await Recibo.findOne({_id:_recibo,estado:"pendiente"});
              const {montoTotal,precioDelivery,_comprador} = foundRecibo;
              foundRecibo.estado = "cancelado";
              foundRecibo.devolucion = Number(montoTotal);
              foundRecibo.venta[0].estado = "cancelado";
              foundRecibo.venta[0].tiendas.forEach(tienda=>{
                tienda.estado = "cancelado";
              });
              await foundRecibo.save();
              //!actualizamos el estado y la devolucion en la compra
              await HistorialCompra.findOneAndUpdate(
                {_user:_comprador,compras:{$elemMatch:{_recibo,estado:"pendiente"}}},
                {
                  $set:{
                    "compras.$.estado":estado,
                    "compras.$.devolucion":Number(montoTotal)
                  }
                }
              );
              io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado,devolucion:{tipo:"set",monto:Number(montoTotal)}});
              //!aqui solo devolvemos el delivery, los montos de las ventas los devolvemos en la parte de correspondiente al historialventa
              console.log("devolviendo delivery 11111");
              await updateCoinsAndNotificate(_comprador,Number(precioDelivery));
            }else{

              const foundRecibo = await Recibo.findOne(
                {
                  _id:_recibo,
                  estado:{$in:["iniciado","pendiente"]}
                }
              );
              const {montoTotal,_comprador,precioDelivery} = foundRecibo;

              //!incrementamos devolucion del recibo en montoventa
              foundRecibo.devolucion = (Number(foundRecibo.devolucion)+Number(montoVenta)).toFixed(2);

              //!filtramos la venta correspondiente
              foundRecibo.venta.forEach(ventaRealizada=>{
                if(ventaRealizada._id.equals(_ventaId)&&ventaRealizada._vendedor.equals(req.user._id)){
                  ventaRealizada.estado = "cancelado";
                  ventaRealizada.tiendas.forEach(tienda=>{
                    tienda.estado = "cancelado";
                  })
                }
              })
              const savedRecibo = await foundRecibo.save();

              //!verificamos si todas las ventas del recibo han sido canceladas:
              let counter = 0;
              savedRecibo.venta.forEach(venta=>{
                if(venta.estado==="cancelado"){
                  counter = counter+1;
                }
              });
              if(counter===savedRecibo.venta.length){//!todas las ventas han sido canceladas
                //!estado del recibo a cancelado y la devolucion del delivery
                await Recibo.findOneAndUpdate(
                  {_id:_recibo},
                  {
                    $inc:{devolucion:precioDelivery},
                    $set:{estado:"cancelado"}
                  }
                );
                //!actualizacion de la compra, incluido su estado final a cancelado y la devolucion del monto de la compra y del delivery
                await HistorialCompra.findOneAndUpdate(
                  {
                    _user:_comprador,
                    compras:{$elemMatch:{_recibo,estado:{$in:["iniciado","pendiente"]}}}},
                  {
                    $set:{
                      "compras.$.estado":"cancelado",
                      "compras.$.devolucion":montoTotal
                    }
                  }
                );
                //!devolvemos el delivery al comprador
                console.log("devolviendo el delivery 222222")
                await updateCoinsAndNotificate(_comprador,Number(precioDelivery));
                //!notificamos la actualizacion en la compra
                io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado:"cancelado",devolucion:{tipo:"set",monto:montoTotal}});
              }else{
                //!actualizamos la devolucion en el historial de compra:
                await HistorialCompra.findOneAndUpdate(
                  {
                    _user:_comprador,
                    compras:{$elemMatch:{_recibo,estado:{$in:["iniciado","pendiente"]}}}},
                  {
                    $inc:{"compras.$.devolucion":Number(montoVenta)}
                  }
                );
                io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado:null,devolucion:{tipo:"inc",monto:Number(montoVenta)}});
              }
              
  
              //!aquui como aun hay mas ventas que hacer no corresponde hacre una devolucion al comprador del precio del delivery
            }
          }
          // }else if(reciboDoc&&reciboDoc.venta.length>1){//!si el recibo tiene muchas ventas, trabajamos en la vneta correspondiente a la cancelacion
          // }

          //!penultimo paso: actualizar el estado de la VENTA en el historial, a cancelado:
          await HistorialVenta.findOneAndUpdate({
            _user:req.user._id,
            ventas:{$elemMatch:{_recibo,estado:"pendiente"}}
          },
          {$set:{"ventas.$.estado":estado,"ventas.$.devolucion":Number(montoVenta)}});
          //* si todo ok, emitimos el evento correspondiente(ventaupdate)
          // io.in(req.user._id.toString()).emit("ventaupdate",{_recibo,estado,devolucion:{tipo:"set",monto:Number(montoVenta)}});
                  
          //!pasamos a hacer las devoluciones de dinero
          //!hacemos el update de los coins al comprador y al vendedor
          //comprador:
          await updateCoinsAndNotificate(reciboDoc._comprador, Number(montoVenta));
          //vendedor:
          await updateCoinsAndNotificate(req.user._id, Number(-montoVenta));
          //!actualizamos los estados dentro de las tiendas a cancelado
          await HistorialVenta.updateMany(
            {_user:req.user._id},
            {$set:{"ventas.$[venta].tiendas.$[tienda].estado":"cancelado"}},
            {arrayFilters:[
              {"venta._recibo":_recibo,"venta.estado":"cancelado"},//a este nivel el estado ya pasó de pendiente a cancelado
              {"tienda.estado":"en tienda"}  
            ]}
          );
          io.in(req.user._id.toString()).emit("ventacancelar",_recibo);
          //!echas las respectivas devoluciones ya podemos retornar
          return res.send({mensaje:"success",token,refreshToken});    
        });
        //*actualizamos
        break;
      default:
        return console.log("break case");
    }  
  });
}

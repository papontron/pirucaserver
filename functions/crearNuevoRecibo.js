const mongoose = require("mongoose");
const Recibo = mongoose.model("recibos");
const {updateCoinsAndNotificate} = require("../functions/updateEasyCoins");
const io = require("../io").getIo();
const crypto = require("crypto");
const HistorialCompra = mongoose.model("historialcompras");
const HistorialVenta = mongoose.model("historialventas");
const Movimiento = mongoose.model("movimientos");

const agregarMovimiento = async (_id,movimiento) =>{
  const movimientosUser = await Movimiento.findOne({_user:_id});
  
  if(!movimientosUser){
    await new Movimiento({_user:_id,movimientos:[movimiento]}).save();
    io.in(_id.toString()).emit("movimientosagregar",movimiento);
    return;
  }else{
    movimientosUser.movimientos.push(movimiento);
    await movimientosUser.save();
    io.in(_id.toString()).emit("movimientosagregar",movimiento);
  }
}

exports.crearReciboAgregarCompraVentaAndNotificate = async (_comprador,newRecibo)=>{
  //+1hora
  const {montoTotal} = newRecibo;
  
  try{
    const recibo = await new Recibo(newRecibo).save();

    //!>>>>agregamos la compra al historial de compras del comprador:
    const codigoRecepcion = crypto.randomBytes(2).toString('hex');

    const newCompra = {   
      _recibo:recibo._id,
      estado:"pendiente",
      monto:recibo.monto,
      precioDelivery:recibo.precioDelivery,
      montoTotal,
      fechaVencimiento:recibo.fechaVencimiento,
      codigoRecepcion,
      _id: new mongoose.Types.ObjectId
    }

    const historialCompraFound = await HistorialCompra.findOne({_user:recibo._comprador});
    if(!historialCompraFound){
      //*si no hay historial lo creamos
      const compraSaved = await new HistorialCompra({_user:recibo._comprador,compras:[newCompra]}).save();

      //!emitimos el evento nuevacompra al comprador
      io.in(_comprador.toString()).emit("nuevacompra",compraSaved.compras[0]);
      //!actualizamos los coins del comprador
      await updateCoinsAndNotificate(_comprador,Number(-montoTotal));
    }else{
      //*si ya existia el historial, pusheamos la nueva compra
      historialCompraFound.compras.push(newCompra);
      //const res = await HistorialCompra.findOneAndUpdate({})
      const compraSaved = await historialCompraFound.save();
      const compra = compraSaved.compras.filter(compra=>{
        return compra._recibo===recibo._id
      })
      //!emitimos el evento nuevacompra al comprador
      io.in(_comprador.toString()).emit("nuevacompra",compra[0]);
      //!actualizamos los coins del comprador
      await updateCoinsAndNotificate(_comprador,-montoTotal);
    }
    //!agregamos a los movimientos del comprador
    const movimiento = {
      tipo:"compra",
      _recibo:recibo._id,
    };
    await agregarMovimiento(_comprador,movimiento);

    //!>>>Agregamos la venta al historial de ventas de cada vendedor (de cada subventa);   
    recibo.venta.forEach( async subVenta=>{

      const newVenta = {
        _courier:subVenta._courier,
        _recibo:recibo._id,
        _comprador:recibo._comprador,
        comprador:recibo.comprador,
        _ventaId:subVenta._id, //!refiere al ID de la venta dentro de recibo.venta[]
        tiendas:subVenta.tiendas,
        montoTotal:subVenta.subTotal,
        fechaVencimiento:recibo.fechaVencimiento,
        estado:"pendiente",
        entregadoCourier:false,
        entregadoCliente:false,
      }
      const historialVentaFound = await HistorialVenta.findOne({_user:subVenta._vendedor});
      
      //!si no existe el record de ventas del usuario, lo creamos
      if(!historialVentaFound){
        const ventaSaved = await new HistorialVenta({_user:subVenta._vendedor,ventas:[newVenta]}).save();
        //!enviamos notificacion nueva venta al vendedor
        io.in(subVenta._vendedor.toString()).emit("nuevaventa",ventaSaved.ventas[0]);
        //!actualizamos los coins del vendedor
        await updateCoinsAndNotificate(subVenta._vendedor,subVenta.subTotal);
      }else{
        historialVentaFound.ventas.push(newVenta);
        const venta = await historialVentaFound.save();
        const ventaSelect = venta.ventas.filter(venta=>{
          return venta._recibo === recibo._id
        })
        //!enviamos notificacion nueva venta al vendedor
        io.in(subVenta._vendedor.toString()).emit("nuevaventa",ventaSelect[0]);
        await updateCoinsAndNotificate(subVenta._vendedor,subVenta.subTotal);
      }
      //!actualizamos sus movimientos
      const movimientoVenta = {
        tipo:"venta",
        _recibo:recibo._id,
      };
      await agregarMovimiento(subVenta._vendedor.toString(),movimientoVenta);
    });
    return recibo._id;
  }catch(e){
    console.log(e.message);
    console.log("error creando recibo");
    return false;
  }
}
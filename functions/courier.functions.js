const {updateCoinsAndNotificate} = require("../functions/updateEasyCoins");
const mongoose = require("mongoose");
const HistorialCompra = mongoose.model("historialcompras");
const Recibo = mongoose.model("recibos");
const HistorialVenta = mongoose.model("historialventas");
const io = require("../io").getIo();

exports.verificarCodigoEntregaCliente = async (codigo,_recibo) =>{
  try{
    const compra = await HistorialCompra.aggregate([
      {$unwind:"$compras"},
      {$match:{
        "compras.estado":"iniciado",
        "compras.codigoRecepcion":codigo,
        "compras._recibo":mongoose.Types.ObjectId.createFromHexString(_recibo)
      }}   
    ]);
    console.log({compra})
    if(compra.length>0) return compra;
    return null; 
  }catch(e){
    console.log("error verificando el codigo de entrega");
    console.log(e.message);
    return null;
  }
}

exports.updateReciboUponDeliveryAndGetDevolucion = async (_recibo,_comprador) =>{
  try{
    const recibo = await Recibo.findOne({_id:_recibo,estado:"iniciado",_comprador});
    const {venta} = recibo; // todas las ventas del recibo
    const vendedores = venta.map(venta=>{
      return venta._vendedor;
    })
    venta.forEach(ventaRealizada=>{
      const {estado,tiendas,subTotal} = ventaRealizada;
      switch(estado){
        case "iniciado": //si la venta figuraba como iniciado, pasa a finalizado
          ventaRealizada.estado="finalizado";//!aqui se podria poner otro estado mas explicido como "falló al entregar los productos"
          break;
        case "pendiente":
          //!su por algun azar la venta aun permanece con estado pendiente
          ventaRealizada.estado="expirado";
          console.log("incrementando la devolucion por una venta pendiente-->expirada")        
          recibo.devolucion =(Number(recibo.devolucion)+Number(subTotal)).toFixed(2);
          //todo: hace falta incrementar la devolucion en la respectiva compra y venta?
          break;
        case "expirado":
          break;
        default:
          console.log(estado, "no soportado");
      }
      tiendas.forEach(tienda=>{     
        const {estado,monto} = tienda;
        switch(estado){
          case "en camino":
            tienda.estado="entregado";
            break;
          case "cancelado":
            break;
          case "expirado":
            break;
          case "en tienda":
            tienda.estado="no entregado";
            recibo.devolucion =(Number(recibo.devolucion)+Number(monto)).toFixed(2);
            break;
          default:
            console.log(estado, "No sportado");
        }
      })    
    })
    recibo.estado = "finalizado";
    const devolucion = recibo.devolucion;
    await recibo.save();
    return {devolucion,vendedores};
  }catch(e){
    console.log("error actualizando el recibo");
    console.log(e.message);
    return null;
  }
}

exports.devolverDineroAndGetVentasCancelar = async (ventasEnTienda,_recibo,_comprador,_courier) =>{//!se hacen las devoluciones de dinero y se llenan los campos devolucion de las ventas, no se actulizan los estados ni de las ventas ni de las tiendsa(VENTAS HISTORIAL),retorna array de ventas para "cancelar", por haber presentado todas sus tiendas fallidas a la hora de entregar productos
  if(ventasEnTienda.length===0||!ventasEnTienda) return [];
  try{
    const ventasCancelar =[];
    ventasEnTienda.forEach(async ventaEnTienda=>{//por cada venta hay un vendedor, y por cada vendedor hay varias tiendas
      const {ventas,_user:_vendedor} = ventaEnTienda;  
      const {tiendas,_id} = ventas; //porq solo trae una venta por cada record, con todas sus tiendas esta vez
      if(tiendas.length===1){//*si solo hay una tienda(con estado "en tienda");
        ventasCancelar.push({_id,_vendedor})
        let montoDevolver = 0; //!monto a devolver de todas las tiendas de un vendedor
        if(tiendas[0].estado==="en tienda"){
          montoDevolver=(Number(montoDevolver)+Number(tiendas[0].monto)).toFixed(2);           
        }
        console.log({montoDevolver});
        //!actualizamos el monto de la devolucion en la venta respectiva
        //quitamos dinero al vendedor
        await updateCoinsAndNotificate(_vendedor.toString(),Number(-montoDevolver));
        //devolvemos el monto al comprador
        await updateCoinsAndNotificate(_comprador,Number(montoDevolver));
        //!finalmente actualizamos el campo devolucion en la venta correspondiente:
        await HistorialVenta.updateOne({_user:_vendedor},
          {$set:{"ventas.$[venta].devolucion":Number(montoDevolver)}},
          {arrayFilters:[{
            "venta._recibo":_recibo,
            "venta._comprador":_comprador,
            "venta._courier":_courier,
          }]}
        );
        //!notificamos actualizacin de la devolucion en la venta
        io.in(_vendedor.toString()).emit("ventaupdate",{_recibo,estado:null,devolucion:{tipo:"set",monto:montoDevolver}})
      }else if(tiendas.length>1){ 
        //!si hay mas de una tienda, ya no la convierte en candidata a cancelar, a menos que todas sus tiendas esten con estado "en tienda"
        let count = 0;
        let montoDevolver = 0;
        tiendas.forEach(tienda=>{
          if(tienda.estado==="en tienda"){
            count +=1;
            montoDevolver=(Number(montoDevolver)+Number(tienda.monto)).toFixed(2);
          }
        })
        //devolvemos el monto al comprador
        await updateCoinsAndNotificate(_comprador,Number(montoDevolver));
        //quitamos dinero al vendedor
        await updateCoinsAndNotificate(_vendedor,-Number(montoDevolver));

        if(count===tiendas.length){//si el contador es igual al length de tiendas, la venta entera se cancelara
          ventasCancelar.push({_id,_vendedor});
        }

        //!finalmente actualizamos el campo devolucion en la venta correspondiente:
        //!una venta puede estar pendiente,iniciada,expirada o cancelada, el siguiente paso solo trata las ventas cuyo estado es iniciado, por lo tanto se asume que no tiene devoluciones, ni las tendría hasta este momento en que el courier liquida la venta.
        await HistorialVenta.updateOne({_user:_vendedor},
          {$set:{"ventas.$[venta].devolucion":Number(montoDevolver)}},
          {arrayFilters:[{
            "venta._recibo":_recibo,
            "venta._comprador":_comprador,
            "venta._courier":_courier,
          }]}
        ); 
        io.in(_vendedor.toString()).emit("ventaupdate",{_recibo,estado:null,devolucion:{tipo:"set",monto:montoDevolver}});           
      }
    })
    return ventasCancelar;  
  }catch(e){
    console.log("error procesando las ventas del recibo")
    console.log(e.message);
    return null;
  }
}
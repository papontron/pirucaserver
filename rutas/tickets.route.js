const { verifyCredentials } = require("../middlewares/verifyCredentials")
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const {generarTicketVenta} = require("../functions/generarTicketVenta");
const mongoose = require("mongoose");
const Recibo = mongoose.model("recibos");
const User = mongoose.model("users");
const Producto = mongoose.model("productos");
const HistorialRecarga = mongoose.model("historialrecargas");
const Tienda = mongoose.model("tiendas");
const HistorialVenta = mongoose.model("historialventas");


module.exports = (app)=>{
  app.post("/api/tickets",verifyOrigin,verifyCredentials, async(req,res)=>{
    const user = req.user;
    const {keys} = req.body;
    console.log({keys:req.body.keys})
    try{
      switch(keys.tipo){
        case "compra":
          const compra = await Recibo.findOne({_id:keys.recibo});
          
          //const clienteCompra = await User.findOne({_id:compra._comprador})

          const {venta,createdAt,monto:montoRecibo,precioDelivery,montoTotal,devolucion} = compra;

          const documentBody = await Promise.all(venta.map(async subVenta=>{//!hacer por cada subventa
            const {tiendas, estado,_vendedor} = subVenta;

            const vendedor = await User.findOne({_id:_vendedor}).select("_id nombres apellidos");
            
            const encabezado = `
              <div class="ticket-encabezado">
                <p>Vendedor:<a target="blank" class="detalles-link" href='/profiles/${vendedor._id}'>${vendedor.nombres} ${vendedor.apellidos}</a></p>
                <p>Le compraste:</p>
                <p>SubTotal: S./ ${subVenta.subTotal}</p>
                <p>Estado: ${estado}</p>
              </div>
            `
            //!porcada tienda:
            const ticketTienda = await Promise.all(tiendas.map(async thisTienda=>{
              const {_tienda,productos,monto,estado} = thisTienda;
              const tienda = await Tienda.findOne({_id:_tienda});

              const ticketProducto = await Promise.all(productos.map(async producto=>{//!por cada producto
                const item = await Producto.findOne({_id:producto._producto});
                return `
                  <div class="ticket-producto">
                    <a class="detalles-link" target="blank" href="/productos/${item._id}">${item.nombre}</a>
                    <p>${item.descripcion}</p>
                    <img src="${item.imagen}" alt="${item.nombre}"/>
                    <p>precio unitario: S/.${producto.precioUnit}</p>
                    <p>cantidad:${producto.cantidad}</p>
                    <p>precioT: S./ ${producto.monto}</p>
                  </div>
                  `
              }));
              return `
                <div class="ticket-tienda">
                <a class="detalles-link" target="blank" href="/tiendas/${tienda._id}">${tienda.nombre}</a>
                <p>monto: S/.${monto}</p>
                <p>estado: ${estado}</p>
                  ${ticketProducto}
                </div>
              `
            }))
            
            return `
              <div class="ticket">
                ${encabezado}
                <div class="ticket-body">
                  ${ticketTienda}
                </div>
              </div>`
          }))

          const documentHeader =`
              <p>Monto: S/. ${montoRecibo}</p>
              <p>Delivery: S/. ${precioDelivery}</p>             
              <p>Monto Total: S/. ${montoTotal.toFixed(2)} </p>
              <p>Devolucion: S/. ${devolucion.toFixed(2)}</p>
              <p>Total Pagado: S/. ${(parseFloat(montoTotal)-parseFloat(devolucion)).toFixed(2)}
              <p>Estado: ${compra.estado} </p>
            `
          const compraFormato =`
            <div class="document-container">
              <div class="document-encabezado">
                ${documentHeader}       
              </div>
              <div class="document-loop">
                ${documentBody}
              </div>
            </div>
            `
          return res.send({
            mensaje:"success",
            data:compraFormato,
            tipo:"compra",
            fecha:createdAt,
            cliente:`${user.nombres} ${user.apellidos}`,
            token:user.token,
            refreshToken:user.refreshToken
          });

        //!caso "venta"  
        case "venta":               
          const {ventaTicket,fechaVenta} = await generarTicketVenta(user._id.toString(),keys.recibo);

          return res.send({
            mensaje:"success",
            fecha:fechaVenta,
            tipo:"venta",
            token:user.token,
            refreshToken:user.refreshToken,
            data:ventaTicket
          });

        case "recarga":
          const historialRecargas = await HistorialRecarga.aggregate([
            {$unwind:"$recargas"},
            {$match:{
              _user:user._id,
              "recargas._id":mongoose.Types.ObjectId.createFromHexString(keys.recibo)
            }}
          ]);
          // .findOne({
          //   _user:user._id,
          //   recargas:{$elemMatch:{_id:keys.recibo}}//}{$elemMatch:{"recargas.$.codigoTrans":keys.ticket}}
          // });
          if(!historialRecargas){
            return res.send({
              mensaje:"la información no existe",
              data:"la información no existe",
              token:user.token,
              refreshToken:user.refreshToken,
              fecha:new Date(),
              tipo:"error"
            })
          }
          // const recarga = historialRecargas.recargas.filter(recarga=>recarga.codigoTrans===keys.recibo);

          // const clienteRecarga = await User.findOne({_id:historialRecargas._user}).select("nombres apellidos");

          // const recargaHeader = `
          //   <p>Recarga: ${recarga[0].codigoTrans}</p>
          //   <p> por ${recarga[0].monto} iziCoins </p>
          //   <p>estado: ${recarga[0].estado}</p>
          // `
          // const recargaBody =`
          //   <p>${clienteRecarga.nombres} ${clienteRecarga.apellidos}</p>
          //   <p>Metodo de pago: ${recarga[0].metodoPago}</p>
          //   <img src="${recarga[0].capturaPago}" alt="${recarga[0].estado}"/>
          //   <p>Monto: S/. ${recarga[0].monto} </p>
          // `
          // const recargaFormato=`
          //   <div class="document-container">
          //     <div class="document-encabezado">       
          //     </div>
          //     <div class="document-loop">
          //       <div class="ticket">
          //         <div class="ticket-encabezado">
          //           ${recargaHeader}
          //         </div>
          //         <div class="ticket-body">
          //           ${recargaBody}
          //         </div>
          //       </div>
          //     </div>
          //   </div>
          //   `
          return res.send({
            mensaje:"success",
            data:historialRecargas[0],
            tipo:"recarga",
            refreshToken:user.refreshToken,
            token:user.token
          });

        default:
          return res.send({mensaje:"este tipo de operacion no está soportada",data:"este tipo de operación no está soportada",token:user.token,refreshToken:user.refreshToken});
      }
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:user.token,
        refreshToken:user.refreshToken
      })
    }
  })
}

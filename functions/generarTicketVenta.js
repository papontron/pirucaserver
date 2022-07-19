const mongoose = require("mongoose");
const User = mongoose.model("users");
const HistorialVenta = mongoose.model("historialventas");
const Producto = mongoose.model("productos");
const Tienda = mongoose.model("tiendas");

exports.generarTicketVenta =async (_vendedor,_recibo)=>{
  const ventaArchivo = await HistorialVenta.aggregate([
    {$unwind:"$ventas"},
    {$match:{
      "_user":mongoose.Types.ObjectId.createFromHexString(_vendedor),
      "ventas._recibo":mongoose.Types.ObjectId.createFromHexString(_recibo),
    }}
  ]);
  console.log({ventaArchivo});
  const {ventas} = ventaArchivo[0];
  const {
    devolucion:devolucionVenta,
    montoTotal:montoVenta,
    tiendas,
    estado,
    _comprador
  } = ventas;
  
  const comprador = await User.findOne({_id:_comprador}).select("nombres apellidos");
  //!seleccionamos la venta que corresponda a este vendedor

  const ventaHeader = `
    <p>cliente: <a target="blank" href="/users/${_comprador}">${comprador.nombres} ${comprador.apellidos}</a></p>
    <p>Monto Total: S/. ${montoVenta}</p>
    <p>Devolución: S/. ${devolucionVenta}</p>
    <p>Total Venta: S/. ${(Number(montoVenta)-Number(devolucionVenta)).toFixed(2)}</p>
    <p>Estado: ${estado}</p>
  `;

  const ventaBody = await Promise.all(tiendas.map(async tienda=>{
    const {_tienda,monto,productos,estado,codigoEntrega} = tienda;
    const tuTienda = await Tienda.findOne({_id:_tienda});

    const ventaTienda = await Promise.all(productos.map(async producto=>{
      const tuProducto = await Producto.findOne({_id:producto._producto});
      return `
      <div class="ticket-producto">
        <p><a target="blank" href="/productos/${producto._producto}">${tuProducto.nombre}</a></p>
        <p>Precio Unit S/.${producto.precioUnit}</p>
        <img src="${tuProducto.imagen}" alt="${tuProducto.nombre}"/>
        <p>x${producto.cantidad}</p>
        <p>Precio T: S/.${producto.monto}</p>
        
      </div>
      `  
    }));
    return `
      <div class="ticket-tienda">
      <a class="detalles-link" target="blank" href="/tiendas/${tuTienda._id}">${tuTienda.nombre}</a>
      <p>Sub Total: S/.${monto}</p>
      <p>Estado: ${estado}</p>
      <p>Codigo Entrega: ${codigoEntrega}</p>
        ${ventaTienda}
      </div>
    `
  }))

  const ventaTicket =`
    <div class="document-container">
      <div class="document-encabezado">       
      </div>
      <div class="document-loop">
        <div class="ticket">
          <div class="ticket-encabezado">
            ${ventaHeader}
          </div>
          <div class="ticket-body">
            ${ventaBody}
          </div>
        </div>
      </div>
    </div>  
  `

  return {ventaTicket,fechaVenta:ventaArchivo[0].createdAt};
}

exports.generarTicketVentaLocal = (venta)=>{
  const {
    devolucion:devolucionVenta,
    montoTotal:montoVenta,
    tiendas,
    estado,
    _comprador,
    comprador,
    createdAt
  } = venta;
  
  //!seleccionamos la venta que corresponda a este vendedor

  const ventaHeader = `
    <p>Fecha: ${new Date(createdAt).toLocaleDateString("es-ES",{
      day:"numeric",
      month:"numeric",
      year:"numeric",
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit"
    })} </p>
    <p>Cliente: <a target="blank" href="/users/${_comprador}">${comprador}</a></p>
    <p>Monto Total: S/. ${montoVenta}</p>
    <p>Devolución: S/. ${devolucionVenta}</p>
    <p>Total Venta: S/. ${(Number(montoVenta)-Number(devolucionVenta)).toFixed(2)}</p>
    <p>Estado: ${estado}</p>
  `;

  const ventaBody = tiendas.map(tienda=>{
    const {_tienda,nombre,monto,productos,estado,codigoEntrega} = tienda;

    const ventaTienda = productos.map(async producto=>{

      return `
      <div class="ticket-producto">
        <p><a target="blank" href="/productos/${producto._producto}">${producto.nombre}</a></p>
        <p>Precio Unit S/.${producto.precioUnit}</p>
        <img src="${producto.imagen}" alt="${producto.nombre}"/>
        <p>x${producto.cantidad}</p>
        <p>Precio T: S/.${producto.monto}</p>        
      </div>
      `  
    });
    return `
      <div class="ticket-tienda">
      <a class="detalles-link" target="blank" href="/tiendas/${_tienda}">${nombre}</a>
      <p>Sub Total: S/.${monto}</p>
      <p>Estado: ${estado}</p>
      <p>Codigo Entrega: ${codigoEntrega}</p>
        ${ventaTienda}
      </div>
    `
  });

  const ventaTicket =`
    <div class="document-container">
      <div class="document-encabezado">       
      </div>
      <div class="document-loop">
        <div class="ticket">
          <div class="ticket-encabezado">
            ${ventaHeader}
          </div>
          <div class="ticket-body">
            ${ventaBody}
          </div>
        </div>
      </div>
    </div>  
  `

  return ventaTicket;
}
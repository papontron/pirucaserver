exports.generarTicketCompraLocal = (recibo)=>{
  const {venta,createdAt,monto:montoRecibo,precioDelivery,montoTotal,devolucion} = recibo;

  const documentBody = venta.map(subVenta=>{//!hacer por cada subventa
    const {tiendas, estado,_vendedor,vendedor} = subVenta;

    const encabezado = `
      <div class="ticket-encabezado">
        <p>Vendedor:<a target="blank" class="detalles-link" href='/profiles/${_vendedor}'>${vendedor}</a></p>
        <p>Le compraste:</p>
        <p>SubTotal: S./ ${subVenta.subTotal}</p>
        <p>Estado: ${estado}</p>
      </div>
    `
    //!porcada tienda:
    const ticketTienda = tiendas.map(thisTienda=>{
      const {_tienda,productos,monto,estado,nombre} = thisTienda;
      const ticketProducto = productos.map(producto=>{//!por cada producto
        const {_producto,nombre,descripcion,imagen,precioUnit,cantidad,monto} = producto;
        return `
          <div class="ticket-producto">
            <a class="detalles-link" target="blank" href="/productos/${_producto}">${nombre}</a>
            <p>${descripcion}</p>
            <img src="${imagen}" alt="${nombre}"/>
            <p>precio unitario: S/.${precioUnit}</p>
            <p>cantidad:${cantidad}</p>
            <p>precioT: S./ ${monto}</p>
          </div>
          `
      });
      return `
        <div class="ticket-tienda">
        <a class="detalles-link" target="blank" href="/tiendas/${_tienda}">${nombre}</a>
        <p>monto: S/.${monto}</p>
        <p>estado: ${estado}</p>
          ${ticketProducto}
        </div>
      `
    });
    
    return `
      <div class="ticket">
        ${encabezado}
        <div class="ticket-body">
          ${ticketTienda}
        </div>
      </div>`
  }))

  const documentHeader =`
      <p>Fecha: ${new Date(createdAt).toLocaleDateString("es-ES",{
        day:"numeric",
        month:"numeric",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit"
      })}
      </p>
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
  return compraFormato;
}
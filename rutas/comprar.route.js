const { verifyCredentials } = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const {verifyCoins} = require("../middlewares/verifyCoins");
const _ = require("lodash");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = mongoose.model("users");
const {sendMensajeAndNotification} = require("../functions/mensajes.functions");
const { crearReciboAgregarCompraVentaAndNotificate } = require("../functions/crearNuevoRecibo");

module.exports = (app) =>{

  app.post("/api/comprar",verifyOrigin,verifyCredentials,verifyCoins, async (req,res)=>{
    //recibimos todos los carItems comprados y los procesamos
    const fecha = new Date();
    const fechaVencimiento = fecha.getTime()+1*1000*20;
    const {user,body} = req;
    const {cartItems,_courier} = body;
    const {token,refreshToken} = user;
    const monto = parseFloat(req.body.monto);
    const precioDelivery = parseFloat(req.body.precioDelivery)
    const montoTotal = parseFloat(req.body.montoTotal);  
    //crea un array con los diferentes vendedores;
    let vendedores=[];
    cartItems.map(item=>{
      if(!vendedores.includes(item.itemOwner)) vendedores.push(item.itemOwner);
    })

    //! creamos un array con la info de cada vendedor
    const vendedoresInfo ={};
    await Promise.all(vendedores.map(async vendedor=>{
      const vendedorInfo = await User.findOne({_id:vendedor}).select("nombres apellidos");
      vendedoresInfo[vendedor] = vendedorInfo.nombres+" "+vendedorInfo.apellidos
    }));

    try{
      //creamos un nuevo recibo en blanco para luego ir llenandola
       //la misma fecha para todos los procedimientos aqui requeridos
      const newRecibo={
        _comprador:user._id,
        comprador:user.nombres+" "+user.apellidos,
        monto,
        precioDelivery,
        montoTotal:montoTotal,
        fechaVencimiento, //agregamos 1 hora
        venta:[]
      }
     const mensajes = {
       comprador:{
         asunto:"Gracias por tu compra!",
         contenido:"Tu compra se a realizado exitosamente, estaremos llevando tus productos lo más pronto posible a tu domicilio, si vas a dejar a un encargado no olvides entregarle el código de recepción que deberá proporcionarle al mensajero luego de verificar la conformidad de su orden.",
         nuevo:true,
         fecha,
         remitente:"Pirula puppy bot"
       },
       vendedores:[],
     }
     //!generando las ventas:
      vendedores.forEach(vendedor=>{//*para cada vendedor
        //const seller = await User.findOne({_id:vendedor}).select("nombres apellidos");
        //!creamos un objecto con todos los productos por vendedor y grabamos

        const venta = {
          _vendedor:vendedor,
          vendedor:vendedoresInfo[vendedor],
          _courier,
          tiendas:[],
          subTotal:"",
        };
 
        //*agrupamos por tiendas que corresponden al mismo vendedor
        const tiendasXvendedor = _.chain(cartItems).map(({itemOwner,tienda})=>itemOwner===vendedor?tienda.id:null).compact().value();

        let _tiendas=[];
        tiendasXvendedor.map(_tienda=>{
          const isDuplicated = _tiendas.includes(_tienda);
          if(!isDuplicated) _tiendas.push(_tienda);
        })

        //*proveemos a cada tienda con sus respectivos productos
        _tiendas.forEach(thisTienda=>{
          //calculo del monto por tienda:
          const productosXtienda = _.chain(cartItems).map(item=>{
            return item.tienda.id===thisTienda?{
            _producto:item.itemId,
            precioUnit:item.itemPrecio,
            cantidad:item.itemCantidad,
            nombre:item.itemNombre,
            descripcion:item.itemDescripcion,
            imagen:item.itemImagen,
            monto:(item.itemPrecio*item.itemCantidad)
          }:null}).compact().value();//.compact().value();//compact elimina los vacios y nulls
          //*calculo del monto de venta de esta tienda:
          const montoTienda = productosXtienda.reduce((a,producto)=>a+Number(producto.monto),0)
          //!tambien podriamos calcular el monto por cada tienda
          const tiendaInfo = _.chain(cartItems).map(item=>item.tienda.id===thisTienda?item.tienda.nombre:null).compact().value();
          const codigoEntrega = crypto.randomBytes(2).toString('hex');
          venta.tiendas.push({
            _tienda:thisTienda,
            nombre:tiendaInfo[0],
            productos:productosXtienda,
            monto:montoTienda,
            codigoEntrega,
            estado:"en tienda"
          });
        });
        //!calculo del subtotal de todo la venta del vendedor
        let subTotal = 0;
        venta.tiendas.forEach(tienda=>{
          const monto = tienda.productos.reduce((a,producto)=>a+producto.precioUnit*producto.cantidad,0);
          subTotal = (Number(subTotal)+ Number(monto)).toFixed(2);
        });
        venta.subTotal = subTotal;
        //!agregamos esta venta al recibo
        newRecibo.venta.push(venta);
        //!creamos el mensaje para el respectivo vendedor
        mensajes.vendedores.push({
          asunto:"acabas de hacer una nueva venta!",
          _user:vendedor,//destinatario
          contenido:"Debes confirmar tu venta para continuar con el proceso. Revisa tus ventas y no olivdes proporcionar el código de entrega de mercancías al courier encargado luego de proporcionar la lista completa de productos. Si no posees todos los productos de la lista deberás rechazar la venta.",
          fecha,
          remitente:"Pirula puppy bot"
        })
      });
      const _recibo = await crearReciboAgregarCompraVentaAndNotificate(user._id,newRecibo);

      //!si todo esta bien, creamos un mensaje para los vendedores y el comprador
      //!agregamos los keys a los mensajes luego de grabar la venta
      mensajes.comprador._recibo=_recibo;

      mensajes.vendedores.forEach(mensaje=>{
        mensaje._recibo=_recibo;
      })

      await sendMensajeAndNotification(user._id,mensajes.comprador);
      
      //!1 memsaje para cada vendedor
      mensajes.vendedores.forEach(async mensaje=>{
        const message = {
          asunto:mensaje.asunto,
          fecha,
          contenido:mensaje.contenido,
          _recibo:mensaje._recibo,
          nuevo:true,
          remitente:mensaje.remitente
        }
        await sendMensajeAndNotification(mensaje._user,message);
      });
      console.log("success comprando");
      return res.send({mensaje:"success",token,refreshToken});
    }catch(e){
      //!seria revisar la venta y el mensaje en caso de que se haya creado solo 1 de ellos y borrarlos en caso de error
      console.log("error comprando",e.message)
      res.send({mensaje:e.message,token,refreshToken});
    }
  })
}
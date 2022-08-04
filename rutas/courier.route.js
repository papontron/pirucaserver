const { verifyCredentials } = require("../middlewares/verifyCredentials");
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const {verifyCourier} = require("../middlewares/verifyCourier");
const mongoose = require("mongoose");
const io = require("../io").getIo();
const Courier = mongoose.model("couriers");
const HistorialVenta = mongoose.model("historialventas");
const User = mongoose.model("users");
const Producto = mongoose.model("productos");
const Tienda = mongoose.model("tiendas");
const Recibo = mongoose.model("recibos");
const HistorialCompra = mongoose.model("historialcompras");
const {updateCoinsAndNotificate} = require("../functions/updateEasyCoins");
const {
  verificarCodigoEntregaCliente,
  updateReciboUponDeliveryAndGetDevolucion,
  devolverDineroAndGetVentasCancelar
} = require("../functions/courier.functions");

module.exports = (app) =>{

  app.post("/courier/entregar_productos_cliente",verifyOrigin,verifyCredentials,verifyCourier,async (req,res)=>{
    console.log("entregando producto a cliente");
    const {user:{_courier,token,refreshToken}} = req;
    const {_recibo,codigo,_comprador} = req.body;
    console.log({_recibo,codigo,_comprador});
    try{
      //!verificar el codigo de entrega al cliente:
      const compra = await verificarCodigoEntregaCliente(codigo,_recibo);
      //!si esque el codigo es correcto y existe la compra con el codigo de recibo, realizamos todo el proceso
      if(!compra) return res.send({mensaje:"codigo de entrega incorrecto",token,refreshToken});
      //*1)actualizamos el recibo
      //!aqui solo se hacen cambios de los estados y actualizaciones del campo devolucion dentro del recibo, NO SE HACEN DEVOLUCIONES DE DINERO NI AL CLIENTE NI AL COMPRADOR, ESA PARTE LA DEJAMOS PARA CUANDO TRABAJEMOS EN EL HISTORIAL DE VENTA
      const response = await updateReciboUponDeliveryAndGetDevolucion(_recibo,_comprador);//!este monto representa el dinero que se agregara a la devolucion proveniente de ventas aceptas por el vendedor pero que fallaron al final
      const vendedores = response.vendedores;
      if(response===null) return res.send({mensaje:"error calculando el monto de devolucion",token,refreshToken});
      //*2)actualizamos la compra:(la actualizacion de la devolucion del recibo ya se hizo en la funcion updateReciboUponDeliveryAndGerDevolucion)
      await HistorialCompra.findOneAndUpdate(
        {
        _user:_comprador,
        compras:{$elemMatch:{_recibo,estado:"iniciado",codigoRecepcion:codigo}}
        },
        {
          $set:{"compras.$.estado":"finalizado"},
          $inc:{"compras.$.devolucion":response.devolucion}
        }
      );
      //!notificamos la actualizacion de la compra:
      io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado:"finalizado",devolucion:{tipo:"inc",monto:response.devolucion}});

      //*actualizamos la venta:
      //*si hubiera una tienda con estado aun en tienda este pasara
      //* a cancelado, porq quiere decir que no se le entregó al courier, y 
      //*se debe hacer la devolucion del dinero;
      //!buscamos tiendas dentro de la venta con estado 'en tienda' para hacer las devoluciones
      //!caso: vendedor acepta la venta(iniciado) pero no entrega los productos
      //!debe pasar de iniciado -> cancelado (estado de la venta)
      const ventasEnTienda = await HistorialVenta.aggregate([//!este query trae cada venta con todas sus tiendas, contal que al menos una tienda este con estado "en tienda"
        {$unwind:"$ventas"},
        //{$unwind:"$ventas.tiendas"},
        {$match:{
          "ventas._recibo":mongoose.Types.ObjectId.createFromHexString(_recibo),
          "ventas._comprador":mongoose.Types.ObjectId.createFromHexString(_comprador),
          "ventas._courier":_courier,
          "ventas.estado":"iniciado",
          "ventas.tiendas.estado":"en tienda"
        }}
      ]);
      console.log({ventasEnTienda});
      //* este proceso clasifica una venta como candidata a ser eliminada solo por contener una tienda con estado "en tienda",
      //*si la venta tuviera varias tiendas igualmente la clasificaria como venta a cancelar aunq las otras tiendas si hubieran entregado
      //todo: lo que se debe hacer no es cancelar la venta, sino incrementar la devolucion por cada tienda con estado "en tienda" y no "en camino"
      //todo: y el estado de la venta debe pasar igualmente a finalizado al menos que la venta solo contenga una tienda
      //si esq existen ventas en tienda
        //console.log({ventasEnTienda:ventasEnTienda[0]});
        //!En el sgte paso se actualiza el campo devolucion en el historial de ventas que contengan tiendas q hayan fallado en entregar los productos previamente aceptados, devuelve el dinero al comprador y al vendedor yretorna todas las ventas con todas sus tiendas falladas.
        const ventasCancelar = await devolverDineroAndGetVentasCancelar(ventasEnTienda,_recibo,_comprador,_courier);
        console.log({ventasCancelar});
        if(ventasCancelar===null) return res.send({mensaje:"error devolviendo dinero y get ventas cancelar",token,refreshToken});
        //ahora que ya se hicieron las devoluciones

        //*actualizamos los estados de las tienda de la venta de "en tienda" a "no entregado"
        await HistorialVenta.updateMany({},
          {$set:{"ventas.$[venta].tiendas.$[tienda].estado":"no entregado"}},
          {arrayFilters:[
            {"venta._recibo":_recibo,"venta._comprador":_comprador,"venta._courier":_courier,"venta.estado":"iniciado"},
            {"tienda.estado":"en tienda"}
          ]}
        );
        //!actualizamos el estado de la venta de iniciado a no entregado(poreq el vendedor acepto pero no entregó los productos);
        //todo: y si el vendedor tien dos tiendas y entrega al menos en una y en las otras falla?
        //todo: en ese caso el estado seguiria como iniciado
        console.log({vendedores1:vendedores});

        ventasCancelar.map(async ventaFalla=>{
          await HistorialVenta.findOneAndUpdate(
            {_user:ventaFalla._vendedor},
            {$set:{"ventas.$[venta].estado":"no entregado"}},
          {arrayFilters:[
            {
              "venta.estado":"iniciado",
              "venta._id":ventaFalla._id,
              "venta._recibo":_recibo
            }
          ]});
          console.log({vendedorFalla:ventaFalla._vendedor});
          io.in(ventaFalla._vendedor.toString()).emit("ventaliquidar",{_recibo,estado:"no entregado",devolucion:null});
        });
        const vendedoresFalla = ventasCancelar.map(venta=>{
          return venta._vendedor;
        })
        const newVendedores = vendedores.filter(_vendedor=>{ 
          return !vendedoresFalla.includes(_vendedor);
        })
        console.log({vendedores2:newVendedores});
        //si no hay ventas en tienda, no se hace ninguna devolucion   
        //actualizamos los estados de las tiendas de "en camino" a "entregado":
        await HistorialVenta.updateMany(
          {},
          {$set:{"ventas.$[venta].tiendas.$[tienda].estado":"entregado"}},
          {arrayFilters:[
            {
              "venta._recibo":_recibo,
              "venta._comprador":_comprador,
              "venta._courier":_courier,
              "venta.estado":"iniciado"
            },
            {"tienda.estado":"en camino"}
          ]}
        );
        //!pasamos las ventas iniciadas a finalizado
        await HistorialVenta.updateMany(
          {ventas:{$elemMatch:{
            _recibo,
            _comprador,
            _courier,
            estado:"iniciado"
          }}},
          {$set:{"ventas.$.estado":"finalizado"}}
        );
        //! todo listo, ya solo queda notificar sobre las actualizaciones 
        //!de los recibos al admin y al courier al cliente y al comprador
        //al admin
        io.in("admins").emit("nuevaventainiciadafinalizada",_recibo);
        //notificacion al courier
        io.in(req.user._id.toString()).emit("misentregasiniciadasentrega",_recibo);

        newVendedores.forEach(vendedor=>{
          io.in(vendedor.toString()).emit("ventaliquidar",{_recibo,estado:"finalizado",devolucion:null});
        });

        console.log("todo ok success entregando venta");
        return res.send({mensaje:"success",token,refreshToken});   
  
    }catch(e){
      console.log("error entregando al cliente");
      console.log(e.message);
      return res.send({mensaje:e.message,token,refreshToken});
    }
  })

  app.post("/courier/recibir_productos_tienda",verifyOrigin,verifyCredentials,verifyCourier,async (req,res)=>{
    const {token,refreshToken,_courier} = req.user;

    const {_vendedor,_tienda,_recibo,codigo} = req.body;
    console.log({_vendedor,_tienda,_recibo,codigo,_courier});
    console.log("recibiendo productos de la tienda");
    try{
      //PRIMERO BUSCAMOS LA VENTA ESPECÍFICA PARA VER SI EXISTE CON EL CODIGO DE ENTREGA CORRECTO
      const ventaFound = await HistorialVenta.aggregate([
        {$unwind:"$ventas"},
        {$unwind:"$ventas.tiendas"},
        {$match:{
        _user:mongoose.Types.ObjectId.createFromHexString(_vendedor) ,
        "ventas._recibo":mongoose.Types.ObjectId.createFromHexString(_recibo),
        "ventas._courier":_courier,
        
        "ventas.estado":"iniciado",
        "ventas.tiendas.estado":"en tienda",
        "ventas.tiendas._tienda":mongoose.Types.ObjectId(_tienda),
        "ventas.tiendas.codigoEntrega":codigo //!este es un codigo de entrega, no de recibo en tienda
        }}]);
      
      if(ventaFound.length>0){ // SI EXISTE EL REGISTRO CON EL CODIGO DE ENTREGA PROPORCIONADO ENTONCES ACTUALIZAMOS A "EN CAMINO"
        const updatedVenta = await HistorialVenta.findOneAndUpdate({
          _user:_vendedor,
          ventas:{$elemMatch:{
          }}
        },{$set:{
          "ventas.$[venta].tiendas.$[tienda].estado":"en camino"
        }},{arrayFilters:[
          {
            "venta._recibo":_recibo,
            "venta._courier":_courier,
            "venta.estado":"iniciado",
          },
          {
            "tienda.estado":"en tienda",
            "tienda._tienda":_tienda,
            "tienda.codigoEntrega":codigo
          }
        ]});


        io.in(_vendedor.toString()).emit("ventaproductosrecibidos",{_recibo,codigoEntrega:codigo});


        //!actualizacion del estado de la tienda dentro del recibo correspondiente
        await Recibo.findOneAndUpdate(
          {_id:_recibo,estado:"iniciado"},
          {$set:{"venta.$[venta].tiendas.$[tienda].estado":"en camino"}},
          {arrayFilters:[
            {
              "venta._vendedor":_vendedor,
              "venta._courier":_courier,
              "venta.estado":"iniciado",
            },
            {
              "tienda.estado":"en tienda",
              "tienda._tienda":_tienda,
              "tienda.codigoEntrega":codigo
            }
          ]});
        //enviamos la notificacion
        io.in(req.user._id.toString()).emit("misentregasiniciadasupdate",{_vendedor,_tienda,_recibo,estado:"en camino"});
        io.in("admins").emit("ventasiniciadasupdate",{_vendedor,_tienda,_recibo,_courier,estado:"en camino"});
        return res.send({mensaje:"success",token,refreshToken});
      }
      return res.send({mensaje:"fail",token,refreshToken})
      
    }catch(e){
      return res.send({mensaje:e.message,token,refreshToken})
    }
    

  });
  app.post("/courier/get_entregas_iniciadas",verifyOrigin,verifyCredentials,verifyCourier,async (req,res)=>{
    const token = req.user.token;
    const refreshToken = req.user.refreshToken;
    console.log({user:req.user});
    console.log({courier:req.user._courier})
    try{
      const entregasIniciadas = await HistorialVenta.aggregate([
        {$unwind:"$ventas"},
        {$match:{"ventas.estado":"iniciado","ventas._courier":req.user._courier}},
        //{$lookup:{from:'users',localField:'_user:',foreignField:'_id',as:"vendedor"}}
      ]);
      //,{"ventas.courierMasCercano._id":req.user._courier}
      console.log({entregasIniciadas});

      const entregasI = await Promise.all(entregasIniciadas.map(async ventaIniciada=>{
        const {ventas,_user} = ventaIniciada;
        const {_comprador,_ventaId,_recibo,tiendas,_courier,estado,createdAt} = ventas;
        console.log({_courier})
        const comprador = await User.findOne({_id:_comprador}).select("nombres apellidos coordenadas telefono");
        const vendedor = await User.findOne({_id:_user}).select("nombres apellidos coordenadas telefono");

        const tiendas2 = await Promise.all(tiendas.map(async tienda=>{
          const {estado,productos} = tienda;
          const productosFound = await Promise.all(productos.map(async producto => {
            const foundProducto = await Producto.findOne({_id:producto._producto}).select("nombre descripcion");
            return {...producto,nombre:foundProducto.nombre,descripcion:foundProducto.descripcion}
          }));
          const tiendaFound = await Tienda.findOne({_id:tienda._tienda}).select("nombre direccion telefono coordenadas");
          return {estado,tiendaInfo:tiendaFound,productos:productosFound}
        }));
        return {vendedor,comprador,estado,_courier,tiendas:tiendas2,fecha:createdAt,_ventaId,_recibo};
      }));
      
      res.send({
        mensaje:"success",
        token,
        refreshToken,
        entregas:entregasI
      })
    }catch(e){
      console.log(e.message);
      res.send({
        mensaje:e.message,
        token,
        refreshToken
      })
    }
  });

  app.get("/couriers/getcouriers",verifyOrigin, async (req,res)=>{
      const couriers = await Courier.find();
      console.log({couriers})
      res.send({
        mensaje:"success",
        couriers
      })
  })
}



const {MongoClient} = require("mongodb");
require("dotenv").config();
const keys = require("../keys/keys");
const client = new MongoClient(keys.mongoUri);
//const io = require("../io").getIo();
//notificar a los clientes cuando hubo una expiracion en sus ventas/compras
//para actualizar sus clientes

exports.runMongo = async (io) =>{
  try{
    await client.connect();
    const database = client.db("testdb");
    const recibos = database.collection("recibos");
    const historialVentas = database.collection("historialventas");
    const historialCompras = database.collection("historialcompras");
    const users = database.collection("users");

    const pipeline = [{"$match":{"operationType":"update",}}];
    //"updateDescription.updatedFields.updatedAt":{"$exists":false}
    const historialVentasChangeStream = historialVentas.watch(pipeline,{fullDocument:'updateLookup'});

    historialVentasChangeStream.on("change", async next=>{
      //!las devoluciones de coins y actualizaciones de los field devolucion se hacen aqui, en compras se hace la devolucion de coins del precio del delivery poreq un recibo expirado implica la devolucion de todo el dinero incluido el delivery
      // console.log({docunent:next.fullDocument});
      // console.log({updatedDescription:next.updateDescription});
      const {updatedFields} = next.updateDescription;
      if(Object.keys(updatedFields).length===1&&Object.values(updatedFields)[0]==="expirado"){ // es el mondo de distinguir entre una actualizacion echa por los triggers y las otras gestionadas por mongoose
        //aqui gestionamos el balance de coins al comprador y vendedor y hacemos las notificacones de estado
        // de los coins a ambos, y del estado de la venta al vendedor
        // console.log(updatedFields);
        const {_user,ventas} = next.fullDocument; 
        const estado = Object.values(updatedFields)[0];
        const lastIndex = Object.keys(updatedFields)[0].indexOf("estado")-1;
        const index = Object.keys(updatedFields)[0].slice(7,lastIndex);
        const venta = ventas[index];
        const {_recibo,montoTotal} = venta;

        const monto = Number(montoTotal);

        const recibo = await recibos.findOne({_id:_recibo});

        const _comprador = recibo._comprador;
        //!devolucion de coins
        await users.updateOne({"_id":_user},{"$inc":{"easyCoins":-monto}});//quitar dinero vendedor
        await users.updateOne({"_id":_comprador},{"$inc":{"easyCoins":monto}});//devolucion de dinero comprador
        io.in(_user.toString()).emit("updatecoins",-monto);
        io.in(_comprador.toString()).emit("updatecoins",monto);

        //!actualizamos la devolucion en el historial de venta
        await historialVentas.updateOne({
          _user,
          ventas:{"$elemMatch":{_recibo}}}
          ,{"$set":{
            "ventas.$.dineroDevuelto":true, //!esto se puede cambiar por un campo devolucion como en las compras y recibos
            "ventas.$.tiendas.$[].estado":"expirado",
            "ventas.$.devolucion":monto
          }
        });
        io.in(_user.toString()).emit("ventaupdate",{_recibo,estado,devolucion:{type:"set",monto}});
        //!actualizamos la devolucion en el historial de compra
        await historialCompras.updateOne(
          {_user:_comprador,compras:{$elemMatch:{_recibo}}},
          {$inc:{"compras.$.devolucion":monto}}
        );
        io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado:null,devolucion:{type:"inc",monto}});
        //!actualizamos la devolucion y el estado en el recibo
        await recibos.updateOne(
          {_id:_recibo,venta:{$elemMatch:{_vendedor:_user}}},
          {
            $set:{"venta.$.estado":"expirado","venta.$.tiendas.$[].estado":"expirado"},
            $inc:{devolucion:monto}
          }
        );

      }else if(Object.keys(updatedFields).length===1&&Object.values(updatedFields)[0].length>1){
        
        const {_user:_vendedor, ventas} = next.fullDocument;

        ventas.forEach(async (venta,i) => {
          if(!venta.dineroDevuelto||(venta.devuelto&&venta.devuelto!==true)){
            const {montoTotal:montoVenta,_recibo,estado} = venta;
            const {_comprador} = await recibos.findOne({_id:_recibo});
            //updating coins
            await users.updateOne({"_id":_vendedor},{"$inc":{"easyCoins":-Number(montoVenta)}});//quitar dinero
            await users.updateOne({"_id":_comprador},{"$inc":{"easyCoins":Number(montoVenta)}});//devolucion de dinero
            io.in(_vendedor.toString()).emit("updatecoins",-Number(montoVenta));          
            io.in(_comprador.toString()).emit("updatecoins",Number(montoVenta));
            //!actualizar la devolucion y estado en el historial de venta
            await historialVentas.updateOne({
              _user:_vendedor,
              ventas:{"$elemMatch":{_recibo}}},
              {"$set":{
                "ventas.$.dineroDevuelto":true,
                "ventas.$.tiendas.$[].estado":"expirado",
                "ventas.$.devolucion":Number(montoVenta)
              }
            });
            io.in(_vendedor.toString()).emit("ventaupdate",{_recibo,estado,devolucion:{tipo:"set",monto:montoVenta}});
            //!actualizamos la devolucion en el historial de compra
            await historialCompras.updateOne(
              {_user:_comprador,compras:{$elemMatch:{_recibo}}},
              {$inc:{"compras.devolucion":Number(montoVenta)}}
            );

            io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado:null,devolucion:{type:"inc",monto}});

            //!actualizamos la devolucion en el recibo
            await recibos.updateOne(
              {_id:_recibo,venta:{$elemMatch:{_vendedor}}},
              {
                $set:{"venta.$.estado":"expirado","venta.$.tiendas.$[].estado":"expirado"},
                $inc:{devolucion:Number(montoVenta)}
              }
            );
          }
        });
      }
    });

    const historialComprasChangeStream = historialCompras.watch(pipeline, {fullDocument:"updateLookup"});

    historialComprasChangeStream.on("change",async next =>{
      const {updatedFields} = next.updateDescription;
      
      if(Object.keys(updatedFields).length===1&&Object.values(updatedFields)[0]==="expirado"){//nuevamente, el length sera 1 solo si la actualizacion
        // se hizo en mongo con triger y como por ahora solo se tiene el triger para actualizar a expirado nos apoyamos en esta unicidad
        //!si una compra a pasado a expirado, es porq ninguna de sus ventas se inicio antes de la fecha limite, por lo tanto corresponde devolver todo el monto al comprador
        //*notificar al comprador que su compra a pasado a expirado
        const {_user,compras} = next.fullDocument;
        const lastIndex = Object.keys(updatedFields)[0].indexOf("estado")-1;
        const index = Object.keys(updatedFields)[0].slice(8,lastIndex);
        const compra = compras[index];
        const {_recibo,precioDelivery,montoTotal} = compra;
        const estado = Object.values(updatedFields)[0];
        
        io.in(_user.toString()).emit("compraupdate",{_recibo:_recibo,estado,devolucion:{type:"inc",monto:precioDelivery}});
        //!devolvemos el precio del delivery a la compra
        await historialCompras.updateOne({
          _user,
          compras:{"$elemMatch":{_recibo}}
        },
        {
          $set:{
          "compras.$.expiracionNotificada":true,
          },
          $inc:{"compras.$.devolucion":Number(precioDelivery)}
        });
        //!agregamos el campo devolucion al RECIBO y seteamos los estados de la tienda tambien a expirado:
        await recibos.updateOne({_id:_recibo},
          {
            $set:{
            "venta.$[venta].estado":"expirado",
            "venta.$[].tiendas.$[tienda].estado":"expirado"
          },
            $inc:{"devolucion":Number(precioDelivery)}
          },
          {arrayFilters:[{"venta.estado":"pendiente"},{"tienda.estado":"en tienda"}]});
        //!devolucion del precio delivery
        await users.updateOne({"_id":_user},{"$inc":{"easyCoins":compra.precioDelivery}});//devolucion de dinero
        io.in(_user.toString()).emit("updatecoins",compra.precioDelivery);
    

      }else if(Object.keys(updatedFields).length===1&&Object.values(updatedFields)[0].length>1){
        //notificar 
        const {_user:_comprador,compras} = next.fullDocument;
        compras.forEach( async (compra,i)=>{
          if(!compra.expiracionNotificada||(compra.expiracionNotificada&&compra.expiracionNotificada!==true)){
            //hallamos el recibo
            console.log("ya entramos", updatedFields);

            const {_recibo,estado,precioDelivery,montoTotal} = compra;
            io.in(_comprador.toString()).emit("compraupdate",{_recibo,estado,devolucion:{type:"inc",monto:precioDelivery}});//notificamos
            //luego agregamos q ya a sido notificado y la devolucion correspondiente en el resgistro de la compra
            await historialCompras.updateOne({
              _user:_comprador,
              compras:{"$elemMatch":{_recibo}}
            },
            {
              $set:{"compras.$.expiracionNotificada":true,},
              $inc:{"compras.$.devolucion":Number(precioDelivery)}
            }
            );
            //!seteamos la devolucion al RECIBO
            await recibos.updateOne(
              {_id:_recibo},
              {
                $set:{
                "venta.$[].estado":"expirado",
                "venta.$[].tiendas.$[].estado":"expirado"
                },
                $inc:{"devolucion":Number(precioDelivery)}
              }
            );
            //devolucion del delivery
            await users.updateOne({_id:_comprador},{"$inc":{"easyCoins":compra.precioDelivery}});
            io.in(_comprador.toString()).emit("updatecoins",compra.precioDelivery);
          }
        })
      }
    });
  }catch(e){
    console.log("error en mongodb updates");
    console.log(e.message);
    await client.close();
  }
}
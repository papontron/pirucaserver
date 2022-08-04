const { verifyCredentials } = require("../middlewares/verifyCredentials")
const { verifyOrigin } = require("../middlewares/verifyOrigin");
const {verifyPirula} = require("../middlewares/verifyPirula");
const mongoose = require("mongoose");
const {sendMensajeAndNotification}  = require("../functions/mensajes.functions");
const {actualizarRecargaPendienteAndNotificate,getRecargasPendientes} = require("../functions/recargas.functions");
const io = require("../io").getIo();
const HistorialVenta = mongoose.model("historialventas");
const User = mongoose.model("users");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");
const Courier = mongoose.model("couriers");
const Categoria = mongoose.model("categorias");
const SubCategoria = mongoose.model("subcategorias");
const Marca = mongoose.model("marcas");

module.exports = (app)=>{

  app.post("/api/admin/get_ventas_iniciadas",verifyOrigin,verifyCredentials,verifyPirula, async (req,res)=>{
    const {token,refreshToken} = req.user;
    try{
      const ventasIniciadas = await HistorialVenta.aggregate([
        {$unwind:"$ventas"},
        {$match:{"ventas.estado":"iniciado"}},
        //{$lookup:{from:'users',localField:'_user:',foreignField:'_id',as:"vendedor"}}
      ]);
      const ventasI = await Promise.all(ventasIniciadas.map(async ventaIniciada=>{
        const {ventas,_user} = ventaIniciada;
        const {_comprador,_ventaId,_recibo,tiendas,_courier,createdAt} = ventas;
        const comprador = await User.findOne({_id:_comprador}).select("nombres apellidos coordenadas telefono");;
        const vendedor = await User.findOne({_id:_user}).select("nombres apellidos coordenadas telefono");;
        const courier = await Courier.findOne({_id:_courier}).select("nombres apellidos");
        const tiendas2 = await Promise.all(tiendas.map(async tienda=>{

          const {estado,productos} = tienda;
          
          const productosFound = await Promise.all(productos.map(async producto => {
            const foundProducto = await Producto.findOne({_id:producto._producto}).select("nombre descripcion");
            return {...producto,nombre:foundProducto.nombre,descripcion:foundProducto.descripcion}
          }));
          const tiendaFound = await Tienda.findOne({_id:tienda._tienda}).select("nombre direccion telefono coordenadas");
          return {estado,tiendaInfo:tiendaFound,productos:productosFound}
        }));

        return {vendedor,comprador,courier,tiendas:tiendas2,fecha:createdAt,_ventaId,_recibo};
      }));
      
      res.send({mensaje:"success",token,refreshToken,ventasIniciadas:ventasI});
    }catch(e){
      console.log({error:e.message});
      res.send({mensaje:e.message,token,refreshToken});
    }
  });

  app.post("/api/admin/get_recargas_pendientes",
  verifyOrigin,verifyCredentials,verifyPirula,
  async(req,res)=>{
    const {token,refreshToken} = req.user;
    try{
      const recargasPendientes = await getRecargasPendientes();
      if(!recargasPendientes) return res.send({mensaje:"error fechando las recargas pendientes",
        token,
        refreshToken
      });
      return res.send({
      mensaje:"success",
      recargas:recargasPendientes,
      token,
      refreshToken
    });
    }catch(e){
      console.log({error:e.message});
      return res.send({mensaje:"error",
      token,
      refreshToken
    });
    }
  });
  app.post("/api/admin/getcategoriasandall",verifyOrigin,verifyCredentials,verifyPirula, async(req,res)=>{
    const {token,refreshToken} = req.user;
    try{
      const subCategorias = await SubCategoria.find({});
      const marcas = await Marca.find({});
      const categorias = await Categoria.find({});
      return res.send({mensaje:"success",token,refreshToken,categorias,subCategorias,marcas});
    }catch(e){
      console.log(e.message);
      return res.send({mensaje:e.message,token,refreshToken});
    }    
  });

  app.post("/api/admin/crearcategoria",verifyOrigin,verifyCredentials,verifyPirula,async(req,res)=>{
    const {token,refreshToken} = req.user;
    const {nombre} = req.body;
    const codigo = nombre.trim().toLowerCase().normalize('NFD').replace(/[\s\u0300-\u036f]/g, "");
    try{
      const categoria = await new Categoria({nombre:nombre.toLowerCase(),codigo}).save();
      io.emit("categoriaagregar",categoria);
      return res.send({mensaje:"success",token,refreshToken});
    }catch(e){
      console.log(e.message);
      res.send({mensaje:e.message,token,refreshToken});
    }
  });

  app.post("/api/admin/eliminarcategoria",verifyOrigin,verifyCredentials,verifyPirula,async(req,res)=>{
    const {token,refreshToken} = req.user;
    const {_categoriaId} = req.body;
    try{
      await Categoria.deleteOne({_id:_categoriaId});
    io.emit("categoriaeliminar",_categoriaId);
    return res.send({mensaje:"success",token,refreshToken});
    }catch(e){
      console.log(e.message);
      res.send({mensaje:e.message,token,refreshToken});
    } 
  });

  app.post("/api/admin/eliminarcourier",verifyOrigin,verifyCredentials,verifyPirula,async(req,res)=>{
    const {_courierId} = req.body;
    const {token,refreshToken} = req.user;
    try{
      await Courier.deleteOne({_id:_courierId});
      await User.updateOne(
        {_courier:_courierId},
        {$set:
          {
          _courier:new mongoose.Types.ObjectId(),
          pirula:"pirula"
          }
        }
      );
      io.emit("courierdelete",_courierId);
      return res.send({mensaje:"success",token,refreshToken});
    }catch(e){
      return res.send({mensaje:e.message,token,refreshToken});
    }
  });
  
  app.post("/api/admin/crearcourier",verifyOrigin,verifyCredentials,verifyPirula,async(req,res)=>{
    const {nombres,apellidos,telefono,email,coordenadas} = req.body;
    const {token,refreshToken} = req.user;
    if(req.user.email===email){
      return res.send({mensaje:"usted no puede convertirse en courier",token,refreshToken});
    }
    try{
      const courier = await new Courier({nombres,apellidos,telefono,email,coordenadas}).save();
      if(!courier){
        return res.send({mensaje:"error creando courier",token,refreshToken});
      }
      const user = await User.findOneAndUpdate({email,telefono},{$set:{_courier:new mongoose.Types.ObjectId(courier._id),pirula:"courier"}},{new:true});
      if(!user){
        return res.send({mensaje:"el usuario no existe",token,refreshToken});
      }
      io.emit("courieragregar",courier);
      res.send({
        mensaje:"success",
        token,refreshToken
      });
    }catch(e){
      console.log(e.message);
      res.send({mensaje:e.message,token,refreshToken});
    }
  });
  app.post("/api/admin/actualizar_recarga_pendiente",verifyOrigin,verifyCredentials,verifyPirula,async (req,res)=>{
    const {_user,recargaId,monto,estado} = req.body;
    const {token,refreshToken} = req.user;
    const fecha = new Date();
    try{
      const resultado = await actualizarRecargaPendienteAndNotificate(_user,recargaId,monto,estado);
      if(!resultado) return res.send({mensaje:"error al actualizar la recarga pendiente",token,refreshToken});
      const mensaje = {
        _id: new mongoose.Types.ObjectId,
        asunto:estado==="aprobado"?"recarga aprobada":"recarga reprobada",
        contenido:estado==="aprobado"?"su recarga fue validada y aprobada":"su recarga no pudo ser validada y a sido reprobada",
        fecha,
        nuevo:true,
      }
      await sendMensajeAndNotification(_user,mensaje);
      return res.send({
        mensaje:"success",
        token,
        refreshToken,
        _user,
        recargaId,
      });  
            
    }catch(e){
      console.log({error:e.message})
      return res.send({mensaje:"no se pudo procesar la recarga",token:req.user.token,refreshToken:req.user.refreshToken});
    }
  })
}
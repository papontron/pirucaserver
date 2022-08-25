const { verifyCredentials } = require("../middlewares/verifyCredentials")
const {verifyOrigin} = require("../middlewares/verifyOrigin");
const { getHashSalt} = require("../middlewares/generateHash")
const _ = require("lodash");

const mongoose = require("mongoose");
const io = require("../io").getIo();
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");

module.exports = (app)=>{

  app.post("/api/borrar_tienda",verifyOrigin,verifyCredentials, async (req,res)=>{
    const user = req.user;
    const {token,refreshToken} = user;
    //extraemos el salt almacenado en el user verificado
    const {tiendaId,password} = req.body;
    const {hash} = getHashSalt(password,user.salt);
    if(hash!==user.hash){
      return res.send({
        mensaje:"usted no está autorizado para realizar esta operación",
        token:user.token,
        refreshToken:user.refreshToken
      })
    }
    
    try{ 
      //verificamos que la tienda pertenezca al usuario
      const foundTienda = await Tienda.findOne({_user:user._id,_id:tiendaId})
      if(!foundTienda) return res.send({
        mensaje:"usted no está autorizado para realizar esta operación",
        token:user.token,
        refreshToken:user.refreshToken
      })
     
      //si se pasan todas las verificaciones de credenciales
      //antes de eliminar la tienda, la eliminamos de los productos existentes
      // const result = await Producto.updateMany({_user:user.Id},{$pull:{_tiendas:tiendaId}})
      await Producto.updateMany({_user:user._id},{$pull:{_tiendas:tiendaId}});
      //eliminamos los  productos con _tiendas:[]
      await Producto.deleteMany({_user:user._id,_tiendas:[]});
      //ahpra si podemos eliminar la tienda
      await Tienda.deleteOne({_user:user.id,id:tiendaId});
      //const tiendas = await Tienda.find({_user:user.id});
      io.emit("tiendadelete",tiendaId);
      //io.emit("productosupdate",tiendaId);
      res.send({
        mensaje:"success",
        token:token,
        refreshToken:refreshToken,
        //tiendas
      });
    }catch(e){
      res.send({
        token:token,
        refreshToken:refreshToken,
        mensaje:e.message
      })
    }
    //comparamos el hash generado con el hash almacenado en el usuario
    
  })

  app.get("/api/get_tiendas",verifyOrigin,async(req,res)=>{
    try{
      const tiendas = await Tienda.find({});
      if(!tiendas||tiendas.length===0){
        return res.send({
          mensaje:"no hay tiendas",
        })
      }
      return res.send({
        mensaje:"success",
        tiendas
      })
    }catch(e){
      res.send({
        mensaje:e.message
      })
    }
  })

  app.post("/api/get_tiendas_cercanas",verifyOrigin,async(req,res)=>{
    try{
      const {coordenadas} = req.body;
      if(!coordenadas||coordenadas===[]){
        return res.send({
          mensaje:"no hay coordenadas"
        })
      }
      console.log({body:req.body})
      const tiendas = await Tienda.find({});
      function deg2rad(deg) {
        return deg * (Math.PI/180)
      }
      function getDistanceFromLatLonInKm(coords1, coords2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(coords2[0]-coords1[0]);  // deg2rad below lat2-lat1
        var dLon = deg2rad(coords2[1]-coords1[1]); // long2- long1
        var a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(coords1[0])) * Math.cos(deg2rad(coords2[0])) * 
          Math.sin(dLon/2) * Math.sin(dLon/2)
          ; 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c; // Distance in km
        var m = d*1000; // distance in meters
        return m;
      }
      const tiendasFiltered = tiendas.filter(tienda=>getDistanceFromLatLonInKm(coordenadas,tienda.coordenadas)<=1500)
      res.send({
        mensaje:"success",
        tiendas:tiendasFiltered
      })
    }catch(e){
      res.send({
        mensaje:e.message
      })
    }
    
  })

  app.post("/api/modificar_tienda",verifyOrigin,verifyCredentials,async (req,res)=>{
    const {nombre,telefono,slogan,logo,tiendaId,tags,descripcion} = req.body;
    if(!nombre||!telefono||!slogan||!logo||!tiendaId||!tags){
      return res.send({
        mensaje:"no pueden haber campos vacíos",
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }
    const user = req.user;
    try{
      //verificar que la tienda pertenece al usuario:
      const tienda = await Tienda.findOne({id:tiendaId,_user:user.id});
      console.log({tienda})
      if(!tienda){
        return res.send({
          mensaje:"usted no está autorizado para realizar esta operación",
          token:user.token,
          refreshToken:user.refreshToken
        })
      }else{
        tienda.nombre=nombre;
        tienda.telefono=telefono;
        tienda.slogan=slogan;
        tienda.logo=logo;
        tienda.tags=tags;
        tienda.descripcion=descripcion;
        const tiendaActualizada = await tienda.save();
        //const tiendas = await Tienda.find({_user:user.id});
        io.emit("tiendaupdate",tiendaActualizada);
        return res.send({
          mensaje:"success",
          //tiendas,
          token:user.token,
          refreshToken:user.refreshToken
        })
      }
    }catch(e){
      res.send({
        mensaje:e.message,
        token:user.token,
        refreshToken:user.refreshToken
      })
    }
  })

  app.post("/api/crear_tienda",verifyOrigin,verifyCredentials,async (req,res)=>{
    try{
      const user = req.user;
      const {nombre,direccion,telefono,slogan,logo,descripcion,tags,coordenadas} = req.body;
      if(!nombre||!direccion||!telefono||!descripcion||!tags||!coordenadas||!slogan||!logo){
        return res.send({
          mensaje:"debe llenar todos los campos",
          token:user.token,
          refreshToken:user.refreshToken
      })
      }
      nuevaTienda = new Tienda({
        _user:user.id,
        nombre,
        direccion,
        telefono,
        slogan,
        logo,
        descripcion,
        tags,
        coordenadas
      })
      
      const tienda = await nuevaTienda.save();
      if(!tienda){
        return res.send({
          mensaje:"no se pudo crear la tienda, intentelo nuevamente",
          token:user.token,
          refreshToken:user.refreshToken
        });
      }
      io.in(req.user._id.toString()).emit("nuevatiendauser",tienda);
      io.emit("nuevatienda",tienda);
      return res.send({
        mensaje:"success",
        token:user.token,
        refreshToken:user.refreshToken,
        //tienda
      });
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }
  });
  app.post("/api/get_tienda_info",verifyOrigin, async (req,res)=>{
    const {_tienda} = req.body;
    console.log(_tienda)
    try{
      const tienda = await Tienda.findOne({_id:_tienda});
      console.log({tienda})
      return res.send({mensaje:"success",tienda});
    }catch(e){
      console.log(e);
      return res.send({mensaje:e.message});
    }
    
  });
}

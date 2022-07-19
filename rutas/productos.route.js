const mongoose = require("mongoose");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const _ = require("lodash");
const Producto = mongoose.model("productos");
const Tienda = mongoose.model("tiendas");
const {verifyOrigin} = require("../middlewares/verifyOrigin");
const io = require("../io").getIo();
module.exports = (app)=>{
  app.get("/api/get_productos",verifyOrigin, async (req,res)=>{//enviar todos los productos a la web
    try{
      console.log("queriying productos");
      const productos = await Producto.find({}).sort({boost:-1});//sort by boost descendent boost:"asc" o boost:"desc"
      return res.send({mensaje:"success",productos});
    }catch(error){
      return res.send({mensaje:error});
    }
  });

  app.post("/api/user/get_user_productos",verifyOrigin, verifyCredentials, async (req,res)=>{//fecth solo los productos del usuario
    try{  
      const productos = await Producto.find({_user:req.user.id});
      res.send({
        mensaje:"success",
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        productos
      })
    }catch(error){
      res.send({
        mensaje:error.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
    }
  })

  //!modificar los productos de una determinada tienda
  app.post("/api/user/modificar_producto_tienda",verifyOrigin, verifyCredentials, async (req,res)=>{
    console.log("modificando producto");
    try{
      //actions: agregarTienda, quitarTienda
      const user = req.user;
      const {productoId,tiendaId,nombre,descripcion,precio,tags,imagen,boost,disponible} = req.body;
      const productoInfo = {productoId,tiendaId,nombre,descripcion,precio,tags,imagen,boost,disponible}
      //!recordar que los tags vienen en forma de string
      //verificar si las tienda enviada en el formulario pertenecen al usuario.
      console.log({tags})
      const tienda = await Tienda.find({id:tiendaId,_user:user.id})
      if(!tienda){
        return res.send({
          mensaje:"no está autorizado para modificar este producto",
          token:req.user.token,
          refreshToken:req.user.refreshToken
        });
      }
      //!modificamos de acuerdo a los valores recibidos
      user.easyCoins -= boost;
      await user.save();
      //!convertimos los tags en un array
      //const tagsArray = tags.split(",");
      //console.log({tagsArray})
      await Producto.findByIdAndUpdate(productoId,
        {$set:{nombre,descripcion,precio,tags,imagen,disponible:(disponible==='true')}},{$inc:{boost:boost}});
      //const productos = await Producto.find({_user:user.id});
      io.emit("productoupdate",productoInfo);
      res.send({
        mensaje:"success",
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        //productos
      })
    }catch(error){
      res.send({
        mensaje:error.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
    }

  })

  app.post("/api/user/eliminar_producto",verifyOrigin, verifyCredentials,async (req,res)=>{//borrar todo el producto de una tienda
    //!enviado desde /dashboard/editarTienda(y sus productos)
    console.log("eliminando un prodcuto");
    try{
      const {productoId,tiendaId} = req.body;// el usuario envia los id de los productos q desea eliminar
      const tienda = await Tienda.findOne({_user:req.user.id,_id:tiendaId});
      const producto = await Producto.findOne({_id:productoId,_user:req.user.id});
      if(!tienda||!producto){
        return res.send({
          mensaje:"no estás autorizado para realizar esta operación",
          token:req.user.token,
          refreshToken:req.user.refreshToken
        })
      }
        //quitamos la tienda de la lista de tiendas del prodcuto
      const tiendasUpdate = producto._tiendas.filter(tienda=>tienda.toString()!==tiendaId);
      if(tiendasUpdate.length===0){
        await Producto.deleteOne({_id:productoId});
      }else{
        producto._tiendas = tiendasUpdate;
        await producto.save();
      }
      io.emit("productodelete",productoId);
      await Producto.find({_user:req.user.id})
      return res.send({
        mensaje:"success",
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        productoId
      });

    }catch(error){
      res.send({
        mensaje:error.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      });
    }   
  })


  //!crear un nuevo producto
  app.post("/api/user/agregar_producto",verifyOrigin, verifyCredentials, async (req,res)=>{  

    try{
      //!enviado desde /dashboard/productos, solo lista todos los productos del usuario
      //! son 10 parametros
      const {tiendasId,nombre,descripcion,precio,tags,imagen,boost,disponible,stock}=req.body;
      if(!tiendasId||!nombre||!descripcion||!precio||!tags||!imagen||!boost||!disponible||!stock){
        return res.send({
          mensaje:"debe llenar todos los campos",
          token:req.user.token,
          refreshToken:req.user.refreshToken
        });
      }

      //const tagsArray = _.chain(tags).split(",").map(tag=>tag.trim()).value();
      const tiendasArray = _.chain(tiendasId).keys().map((key)=>{
        if(tiendasId[key]===true){
          return key;
        }
        return;
      }).compact().value(); 

      if(tiendasArray.length===0){
        return res.send({
          token:req.user.token,
          refreshToken:req.user.refreshToken,
          mensaje:"debe indicar al menos una tienda para el producto"
        });
      }
      const verificationErrors = [];
      //!verificar si el usuario es dueño de las tiendas con que está registrando el producto
      tiendasArray.forEach(async tiendaId => {
        const foundTienda = await Tienda.findOne({id:tiendaId,_user:req.user.id});
        if(!foundTienda){
           return verificationErrors.push(tiendaId);
        }
        return;
      });

      if(verificationErrors.length>0){
        return res.send({
          mensaje:"usted no posee las credenciales para realizar esta operación",
          token:req.user.token,
          refreshToken:req.user.refreshToken
        });
      }

      const newProducto = new Producto({
        _tiendas:tiendasArray,
        nombre,
        descripcion,
        stock,
        precio,
        disponible,
        tags:tags.replace(/\s+/g, ""),
        imagen,
        boost,
        _user:req.user.id
      });
      const createdProducto = await newProducto.save();
      //const productos = await Producto.find({_user:req.user.id})
      io.emit("nuevoproducto",createdProducto);
      io.in(req.user.id.toString()).emit("nuevouserproducto",createdProducto);
      return res.send({
        mensaje:"success",
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        //producto:created
      });

    }catch(error){
      return res.send({
        mensaje:error.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }
  })
}
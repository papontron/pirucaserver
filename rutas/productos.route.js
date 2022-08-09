const mongoose = require("mongoose");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const _ = require("lodash");
const Producto = mongoose.model("productos");
const Tienda = mongoose.model("tiendas");
const {verifyOrigin} = require("../middlewares/verifyOrigin");
const io = require("../io").getIo();
module.exports = (app)=>{

  app.get("/api/productos/categorias/:categoria",verifyOrigin, async (req,res)=>{
    const {categoria} = req.params;
    try{
      const productos = await Producto.find({"categoria.codigo":categoria}).limit(50);
      res.send({mensaje:"success",productos});

    }catch(e){
      console.log(e);
      res.send({mensaje:e.message});
    }
  });

  app.get("/api/get_productos",verifyOrigin, async (req,res)=>{//enviar todos los productos a la web
    try{
      console.log("queriying productos");
      const productos = await Producto.find({}).sort({boost:-1});//sort by boost descendent boost:"asc" o boost:"desc"
      return res.send({mensaje:"success",productos});
    }catch(error){
      return res.send({mensaje:error});
    }
  });

  app.post("/api/user/get_user_productos_by_page",verifyOrigin,verifyCredentials,async (req,res)=>{
    const {user} = req;
    const {token,refreshToken} = user;
    const {page, productsPerPage, tiendaId} = req.body;
    //pages can be: 1,2,3,4,5

    const skip = (page-1)*productsPerPage

    try{
      const productos = await Producto.find({_user:user._id,_tiendas:{$in:[tiendaId]}}).skip(skip).limit(productsPerPage);
      console.log({productos})
      return res.send({mensaje:"success",token,refreshToken,productos});
    }catch(e){
      console.log(e.message);
      return res.send({mensaje:e.message,token,refreshToken});
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
  app.post("/api/user/get_total_productos_count",verifyOrigin,verifyCredentials, async (req,res)=>{
    const {user} = req;
    const {token,refreshToken,tiendaId} = user;
    try{
      const count = await Producto.find({_user:user._id,_tiendas:{$in:[tiendaId]}}).estimatedDocumentCount();
      return res.send({mensaje:"success",token,refreshToken,count});
    }catch(e){
      console.log(e.message);
      res.send({mensaje:e.message,token,refreshToken})
    }
  });
  //!modificar los productos de una determinada tienda
  app.post("/api/user/modificar_producto_tienda",verifyOrigin, verifyCredentials, async (req,res)=>{
    const user = req.user;
    const {token,refreshToken} = user;
    console.log("modificando producto");
    try{
      //actions: agregarTienda, quitarTienda
      
      const {productoId,tiendaId,nombre,descripcion,precio,tags,imagen,boost,disponible,categoria} = req.body;
     
      const productoInfo = {productoId,tiendaId,nombre,descripcion,precio,tags,imagen,boost,disponible,categoria};
      //!recordar que los tags vienen en forma de string
      //verificar si las tienda enviada en el formulario pertenecen al usuario.
      const tienda = await Tienda.find({id:tiendaId,_user:user.id})
      if(!tienda){
        return res.send({
          mensaje:"no está autorizado para modificar este producto",
          token,
          refreshToken
        });
      }
      //!modificamos de acuerdo a los valores recibidos
      const producto = await Producto.findOne({_id:productoId});

      const price = parseInt(boost) - parseInt(producto.boost);
      if(user.easyCoins<price){
        return res.send({mensaje:"no tienes suficientes coins",token,
        refreshToken})
      }
      const newCoins = Number(user.easyCoins) - Number(price);
      console.log({newCoins})
      user.easyCoins = newCoins.toFixed(2);
      await user.save();
      io.in(user._id.toString()).emit("updatecoins",Number(price));
      //!convertimos los tags en un array
      await Producto.findByIdAndUpdate(productoId,
        {$set:{nombre,descripcion,precio,tags,imagen,disponible:(disponible==='true')},boost,categoria});
      //const productos = await Producto.find({_user:user.id});
      io.emit("productoupdate",productoInfo);
      res.send({
        mensaje:"success",
        token,
        refreshToken
        //productos
      })
    }catch(error){
      res.send({
        mensaje:error.message,
        token,
        refreshToken
      });
    }

  });

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
    const {user} = req;
    const {easyCoins,token,refreshToken} = user;
    try{
      //!enviado desde /dashboard/productos, solo lista todos los productos del usuario
      //! son 10 parametros
      const {tiendasId,nombre,descripcion,precio,tags,imagen,boost,disponible,stock,categoria}=req.body;
      if(!tiendasId||!nombre||!descripcion||!precio||!tags||!imagen||!boost||!disponible||!stock||!categoria){
        return res.send({
          mensaje:"debe llenar todos los campos",
          token,
          refreshToken
        });
      }
      if(easyCoins<boost){
        return res.send({mensaje:"no tienes fondos suficientes para promocionar tu producto, prueba con otra cantidad",token,refreshToken})
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
          token,
          refreshToken,
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
          token,
          refreshToken
        });
      }
      user.easyCoins = (user.easyCoins - boost).toFixed(2);
      await user.save();
      io.in(user._id.toString()).emit("updatecoins",Number(-boost));
      const newProducto = new Producto({
        _tiendas:tiendasArray,
        nombre,
        descripcion,
        stock,
        precio,
        disponible,
        categoria,
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
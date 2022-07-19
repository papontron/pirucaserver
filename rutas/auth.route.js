const {verifyPassword} = require("../middlewares/verifyPassword");
const {verifyCredentials} = require("../middlewares/verifyCredentials");
const {getHashSalt} = require("../middlewares/generateHash");
const mongoose = require("mongoose");
const { getToken, getRefreshToken} = require("../middlewares/generateTokens");
const {verifyOrigin} = require("../middlewares/verifyOrigin");
const User = mongoose.model("users");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");
const Buzon = mongoose.model("buzones");
const HistorialRecarga = mongoose.model("historialrecargas");
const HistorialCompra = mongoose.model("historialcompras");
const HistorialVenta = mongoose.model("historialventas");
const Movimiento = mongoose.model("movimientos");

module.exports = (app)=>{
  app.post("/api/verify_telefono",verifyOrigin, async (req,res)=>{
    const {telefono} = req.body;
    try{
      const user = await User.findOne({telefono});
      console.log({user})
      if(!user){
        res.send({mensaje:"success"});
      }else{
        res.send({mensaje:"este teléfono no está disponible"});
      }
    }catch(e){  
      res.send({mensaje:e.message});
    }
  })

  app.post("/api/check_email_in_use",verifyOrigin,async (req,res)=>{

    const {email} = req.body;
    try{
      const user = await User.findOne({email});
      if(user){
        return res.send({mensaje:"el email ya está en uso"})
      }else{
        return res.send({mensaje:"success"});
      }
    }catch(e){  
      return res.send({mensaje:e.message})
    }
  })
  app.post("/api/signup",verifyOrigin,async (req,res)=>{
    try{
      const {email,password,nombres,apellidos,telefono,direccion,imagen,coordenadas} = req.body;
      if(!email||!password||!nombres||!apellidos||!telefono||!direccion||!coordenadas){
        return res.send({mensaje:"debes llenar todos los campos del formulario"});
      }
      const foundUser = await User.findOne({email})
      if(foundUser){
        return res.send({mensaje:"este email no está disponible"})
      }
      const {hash,salt} = getHashSalt(password);
      const newUser = new User({
        email,
        nombres,
        apellidos,
        telefono,
        direccion,
        hash,
        salt,
        imagen,
        coordenadas
      });
      const user = await newUser.save();
      const token = getToken(user.id);
      const refreshToken = getRefreshToken(user.email);
      user.token = token;
      user.refreshToken = refreshToken;
      await user.save();
      return res.send({
          mensaje:"success",
          _id:user._id,
          nombres,
          apellidos,
          email,
          easyCoins:user.easyCoins,
          direccion:user.direccion,
          telefono:user.telefono,
          coordenadas,
          token,
          refreshToken,
          tiendas:[],
          productos:[],
          mensajes:[],
          compras:[],
          ventas:[],
          pirula:user.pirula,
          movimientos:[]
      });
    }catch(error){
      await User.deleteOne({email:req.body.email});
      res.send({mensaje:error.message});
    }
  });

  app.post("/api/login",verifyOrigin, verifyPassword , async (req,res)=>{
    //enviamos los mensajes, las tiendas, y los productos junto con la data del usuario
    try{  

      const tiendas = await Tienda.find({_user:req.user._id});
      const productos = await Producto.find({_user:req.user._id})
      const buzonEntrada = await Buzon.findOne({_user:req.user._id});
      const historialRecargas = await HistorialRecarga.findOne({_user:req.user._id});
      const historialVentas = await HistorialVenta.findOne({_user:req.user._id});
      const historialCompras = await HistorialCompra.findOne({_user:req.user._id});
      const movimiento = await Movimiento.findOne({_user:req.user._id});
      //enviamos todas las tiendas y todos los productos pertenecientes al usuario
      return res.send({
        mensaje:"success",
        _id:req.user._id,
        email:req.user.email,
        nombres:req.user.nombres,
        apellidos:req.user.apellidos,
        easyCoins:req.user.easyCoins,
        direccion:req.user.direccion,
        telefono:req.user.telefono,
        coordenadas:req.user.coordenadas,
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        tiendas:tiendas.length!==0?tiendas:[],
        productos:productos.length!==0?productos:[],
        mensajes:buzonEntrada?buzonEntrada.mensajes:[],
        recargas:historialRecargas?historialRecargas.recargas:[],
        compras:historialCompras?historialCompras.compras:[],
        ventas:historialVentas?historialVentas.ventas:[],
        pirula:req.user.pirula,
        movimientos:movimiento?movimiento.movimientos:[]
      });
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }  
  });

  app.post("/api/refresh_token",verifyOrigin,verifyCredentials,async (req,res)=>{
    const {_id} = req.user;
    try{  
      const tiendas = await Tienda.find({_user:_id});
      const productos = await Producto.find({_user:_id})
      const buzonEntrada = await Buzon.findOne({_user:_id});  
      const historialRecargas = await HistorialRecarga.findOne({_user:_id});
      const historialVentas = await HistorialVenta.findOne({_user:_id});
      const historialCompras = await HistorialCompra.findOne({_user:_id});
      const movimiento = await Movimiento.findOne({_user:_id});
 
      //enviamos todas las tiendas y todos los productos pertenecientes al usuario
      return res.send({
        _id:req.user._id,
        mensaje:"success",
        email:req.user.email,
        nombres:req.user.nombres,
        apellidos:req.user.apellidos,
        easyCoins:req.user.easyCoins,
        direccion:req.user.direccion,
        telefono:req.user.telefono,
        coordenadas:req.user.coordenadas,
        token:req.user.token,
        refreshToken:req.user.refreshToken,
        tiendas:tiendas.length!==0?tiendas:[],
        productos:productos.length!==0?productos:[],
        mensajes:buzonEntrada?buzonEntrada.mensajes:[],
        recargas:historialRecargas?historialRecargas.recargas:[],
        compras:historialCompras?historialCompras.compras:[],
        ventas:historialVentas?historialVentas.ventas:[],
        pirula:req.user.pirula,
        movimientos:movimiento?movimiento.movimientos:[]
      });
    }catch(e){
      return res.send({
        mensaje:e.message,
        token:req.user.token,
        refreshToken:req.user.refreshToken
      })
    }
  });
  

  app.post("/api/perfil",verifyOrigin,verifyCredentials,async (req,res)=>{
    res.send({
      mensaje:"success",
      token:req.user.token,
      refreshToken:req.user.refreshToken,      
      direccion:req.user.direccion,
      telefono:req.user.telefono,
      nombres:req.user.nombres,
      apellidos:req.user.apellidos
    })
  });

  app.post("/api/logout",verifyOrigin, verifyCredentials,async (req,res)=>{
    const user = req.user;
    try{
      user.token = "";
      user.refreshToken="";
      await user.save();
      req.user = null;
      return res.send({mensaje:"success"})
    }catch(error){
      return res.send({mensaje:error.message});
    }    
  });
};
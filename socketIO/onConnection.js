const mongoose = require("mongoose");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");
const User = mongoose.model("users");
const Courier = mongoose.model("couriers");
const Categoria = mongoose.model("categorias");
module.exports = (io)=>{
  io.on("connection",(socket)=>{
      console.log("the connection has been stablished");
      async function getInitData(){
        console.log("sending initial data");
        try{
          const tiendas = await Tienda.find({});
          const productos = await Producto.find({});
          const couriers = await Courier.find({});
          const categorias = await Categoria.find({});
          //socket.emit("connected",{mensaje:"success",tiendas,productos}); averiguar las diferencias socket.emit vs io.emit
          io.emit("connected",{mensaje:"success",tiendas,productos,couriers,categorias});
        }catch(e){  
          io.emit("connected",{mensaje:"error al jalar las tiendas o productos"});
        }
      }

      getInitData();

      socket.on("logout",async (user)=>{
        console.log("loggin out sockte:",user)
        socket.leave(user.toString());
        const usuario = await User.findOne({_id:user});
        if(usuario.pirula==="sarca"){
          console.log("loggin out admin")
          socket.leave("admins");
        }
      });
      socket.on("logged",async (userId)=>{     
        console.log("logeando user al room");
        socket.join(userId);//joins a room named with the user id
        const user = await User.findOne({_id:userId});
        if(user.pirula==="sarca"){
          console.log("logeando admin")
          socket.join("admins");
        }        
      });
      socket.on("disconnect",(reason)=>{
        console.log("socket disconected");
        console.log({reason});
      })
  });
} 
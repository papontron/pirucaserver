const mongoose = require("mongoose");
const Tienda = mongoose.model("tiendas");
const Producto = mongoose.model("productos");
const User = mongoose.model("users");
module.exports = (io)=>{
  io.on("connection",(socket)=>{
      socket.on("logout",async (user)=>{
        socket.leave(user);
        const usuario = await User.findOne({_id:user});
        if(usuario.pirula==="sarca"){
          console.log("loggin out admin")
          socket.leave("admins");
        } 
      })
      socket.on("logged",async (userId)=>{
        
        console.log("logeando user al room");
        socket.join(userId);//joins a room named with the user id
        const user = await User.findOne({_id:userId});
        if(user.pirula==="sarca"){
          console.log("logeando admin")
          socket.join("admins");
        }        
      });
      socket.on("connected",(args)=>{
        console.log(args)
        async function getInitData(){
          try{
            const tiendas = await Tienda.find({});
            const productos = await Producto.find({});
            //socket.emit("connected",{mensaje:"success",tiendas,productos}); averiguar las diferencias socket.emit vs io.emit
            io.emit("connected",{mensaje:"success",tiendas,productos});
          }catch(e){  
            io.emit("connected",{mensaje:"error al jalar las tiendas o productos"});
          }
        }
        getInitData();
      })
  });

} 
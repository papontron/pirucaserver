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
          //tratar de fetchear solo tiendas cercanas
          const tiendas = await Tienda.find({});
          //fetchear solo productos de las tiendas cercanas
          const productos = await Producto.find({}).sort([["boost",-1]]).limit(25);
          const masVendidos = await Producto.find({}).sort([["vendidos",-1]]).limit(25);
          const newArrivals = await Producto.find({}).sort([["createdAt",-1]]).limit(25);
          //fetchear couriers cercanos
          const couriers = await Courier.find({});
          const categorias = await Categoria.find({}).sort({codigo:1});

          async function fetchCategoriasCount(){
            const categoriasCount = await Promise.all(categorias.map(async categoria=>{

              const count = await Producto.findOne({"categoria.codigo":categoria.codigo}).countDocuments();

              const newCategoria = {nombre:categoria.nombre,codigo:categoria.codigo,count};

              return newCategoria;
            }));
            return categoriasCount;
          }

          const categoriasCount = await fetchCategoriasCount();

          //socket.emit("connected",{mensaje:"success",tiendas,productos}); averiguar las diferencias socket.emit vs io.emit
          io.emit("connected",{mensaje:"success",tiendas,productos,couriers,categorias:categoriasCount,masVendidos,newArrivals});
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
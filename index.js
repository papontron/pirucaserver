const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const {readdirSync} = require("fs");
const {runMongo} = require("./mongoClient/mongo");
const keys = require("./keys/keys");
// const { Server } = require("socket.io");
require("dotenv").config();
// require("./models/user.model");
// require("./models/producto.model");
// require("./models/tienda.model");
// require("./models/recibo.model");
// require("./models/buzon.model");
// require("./models/historialRecarga.model");
// require("./models/historialCompra.model");
// require("./models/historialVenta.model");
readdirSync("./models").map(model=>require("./models/"+model))


mongoose.connect(keys.mongoUri);

const app = express();
app.use(cors({origin:keys.corsOrigin,methods: ["GET", "POST"]}));
app.use(bodyParser.json());
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT);
const io = require("./io").init(server);
require("./socketIO/onConnection")(io);
runMongo(io);
//rutas
// require("./rutas/auth.route")(app);
// require("./rutas/productos.route")(app);
// require("./rutas/userProfile.route")(app);
// require("./rutas/dashboard")(app);
// require("./rutas/recargas.route")(app);
// require("./rutas/tiendas.route")(app);
// require("./rutas/comprar.route")(app);
// require("./rutas/buzon.route")(app);
// require("./rutas/tickets.route")(app);
// require("./rutas/onLaunch.route")(app);
readdirSync("./rutas").map(ruta=>(require("./rutas/"+ruta)(app)))


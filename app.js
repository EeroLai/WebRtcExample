const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
//抽取出來的位置
const registerWebRtcHandlers = require("./Handler/webRtc.js");

const app = express();
const httpServer = createServer(app);

//這邊前後端是分離的需要配置CORS相關設定
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

//把相關會用到的功能抽取出來方便未來維護上的困難度
const onConnection = (socket) => {
  registerWebRtcHandlers(io, socket);
}

io.on("connection", onConnection);

httpServer.listen(3000);

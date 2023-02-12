module.exports = (io, socket) => {
    //socket 關閉
    socket.on('disconnect', function (reason) {
        var socketId = socket.id;
        console.log('disconnect: ' + socketId + ' reason:' + reason);
        var message = {};
        message.from = socketId;
        message.room = '';
        socket.broadcast.emit('exit', message);
    });
    /** client => Signaling Server **/
    socket.on('createAndJoinRoom', function (message) {
        var room = message.room;
        var clientsInRoom = io.sockets.adapter.rooms.get(room);
        var numClients = clientsInRoom ? clientsInRoom.size : 0;
        var data = {
            id: socket.id,
            room: room
        };
        console.log('Room ' + room + ' now has ' + numClients + ' client(s)');
        if (clientsInRoom) {
            console.log(clientsInRoom.size);
        }
        if (numClients === 0) {
            /** room 不存在直接創建（socket.join）*/
            //加入並創建
            socket.join(room);
            console.log('Client ID ' + socket.id + ' created room ' + room);

            data.peers = [];

            socket.emit('created', data);
        } else {
            /** room 存在 */
            //發送 joined 訊息至room內的其他 Client [id,room]
            io.sockets.in(room).emit('joined', data);

            //其他連接
            var peers = new Array();
            var otherSocketIds = clientsInRoom;
            console.log('Socket length ' + otherSocketIds.size);
            otherSocketIds.forEach(elemen => {
                var peer = {};
                peer.id = elemen;
                peers.push(peer);
            });
            data.peers = peers;
            //發送 created 訊息至 Client [id,room,peers]
            socket.emit('created', data);

            //加入房間
            socket.join(room);
            console.log('Client ID ' + socket.id + ' joined room ' + room);
        }

    });

    //轉發 offer 訊息至room內的其他 Client [from,to,room,sdp]
    socket.on('offer', function (message) {
        var room = Object.keys(socket.rooms)[1];
        console.log('Received offer: ' + message.from + ' room:' + room);
        //console.log(' message: ' + JSON.stringify(message));
        //透過socket.id找到對應傳送位置
        var otherClient = io.sockets.sockets.get(message.to);
        if (!otherClient) {
            return;
        }
        //轉發 offer 訊息至其他 Client
        otherClient.emit('offer', message);

    });

    //轉發 answer 訊息至room內的其他 Client [from,to,room,sdp]
    socket.on('answer', function (message) {
        var room = Object.keys(socket.rooms)[1];
        console.log('Received answer: ' + message.from + ' room:' + room);
        //console.log(' message: ' + JSON.stringify(message));
        //透過socket.id找到對應傳送位置
        var otherClient = io.sockets.sockets.get(message.to);
        if (!otherClient) {
            return;
        }
        //轉發 answer 訊息至其他 Client
        otherClient.emit('answer', message);
    });

    //轉發 candidate 訊息至room內的其他 Client  [from,to,room,candidate[sdpMid,sdpMLineIndex,sdp]]
    socket.on('candidate', function (message) {
        console.log('Received candidate: ' + message.from);
        //console.log(' message: ' + JSON.stringify(message));
        //透過socket.id找到對應傳送位置
        var otherClient = io.sockets.sockets.get(message.to);
        if (!otherClient) {
            return;
        }
        //轉發 candidate 訊息至其他 Client
        otherClient.emit('candidate', message);
    });
};
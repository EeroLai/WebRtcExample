const socketURL = "ws://localhost:3000";
const roomName = "Room"
const socket = io(socketURL);

var roomId;
var socketId;
var user_name;
var localStream;
var rtcConnects = {};
var config = {
    iceServers: [
        {
            urls: 'stun:stun.xten.com'
        }
    ]
};
var offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
}
var msg_content = $('#msg_content');
var msg_text = $('#msg_text');
var send_btn = $('#send_btn');
var localVideo = document.querySelector('video#localVideo');
var remoteVideo = document.querySelector('video#remoteVideo');
var webRtcJoin_Btn = $('#webRtcJoin_btn');

/** WebRtc相關 **/
//建構 WebRtc 並且return
function getOrCreateRtcConnect(socketId) {
    if (!socketId) return;
    var pc = rtcConnects[socketId];
    if (typeof (pc) == 'undefined') {
        //建構RTCPeerConnection
        pc = new RTCPeerConnection(config);
        pc.onicecandidate = e => onIceCandidate(pc, socketId, e);
        pc.ontrack = e => onTrack(pc, socketId, e);
        if (localStream != null) {
            localStream.getTracks().forEach(function (track) {
                pc.addTrack(track, localStream);
            });
        }
        pc.onremovestream = e => onRemoveStream(pc, socketId, e);
        //保存peer連接
        rtcConnects[socketId] = pc;
    }
    return pc;
}

//移除webRTC連接
function removeRtcConnect(socketId) {
    delete rtcConnects[socketId];
}

//绑定localMedia至VideoV
function gotStream(stream) {
    localVideo.srcObject = stream;
    localStream = stream;
}

/** WebRtc RTCPeerConnection 事件相關  **/
//icecandidate info
function onIceCandidate(pc, id, event) {
    //向Server發送 candidate [from,to,room,candidate[sdpMid,sdpMLineIndex,sdp]]
    console.log('onIceCandidate to ' + id + ' candidate ' + event);
    if (event.candidate != null) {
        var message = {};
        message.from = socketId;
        message.to = id;
        message.room = roomId;
        var candidate = {};
        candidate.sdpMid = event.candidate.sdpMid;
        candidate.sdpMLineIndex = event.candidate.sdpMLineIndex;
        candidate.sdp = event.candidate.candidate;
        message.candidate = candidate;
        socket.emit('candidate', message);
    }
}


//stream onTrack
function onTrack(pc, id, event) {
    console.log('onTrack from ' + event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
}

//onRemoveStream
function onRemoveStream(pc, id, event) {
    console.log('onRemoveStream from ' + id);
    getOrCreateRtcConnect(id).close;
    delete rtcConnects[id];
    $('remoteDiv').removeChild($(id));
}

//offer 創建成功
function onCreateOfferSuccess(pc, id, offer) {
    console.log('createOffer: success ' + ' id:' + id + ' offer ' + JSON.stringify(offer));
    pc.setLocalDescription(offer);
    var message = {};
    message.from = socketId;
    message.to = id;
    message.room = roomId;
    message.sdp = offer.sdp;
    socket.emit('offer', message);
}

//offer 創建失敗
function onCreateOfferError(pc, id, error) {
    console.log('createOffer: fail error ' + error);
}

//answer 創建成功
function onCreateAnswerSuccess(pc, id, offer) {
    console.log('createAnswer: success ' + ' id:' + id + ' offer ' + JSON.stringify(offer));
    pc.setLocalDescription(offer);
    var message = {};
    message.from = socketId;
    message.to = id;
    message.room = roomId;
    message.sdp = offer.sdp;
    socket.emit('answer', message);
}

//answer 創建失敗
function onCreateAnswerError(pc, id, error) {
    console.log('createAnswer: fail error ' + error);
}

/** Signaling Server */

//created [id,room,peers]
socket.on('created', async function (data) {
    console.log('created: ' + JSON.stringify(data));
    socketId = data.id;
    roomId = data.room;
    //根據回應的peers 循環創建WebRtcPeerConnection & 發送offer訊息 [from,to,room,sdp]
    for (let i = 0; i < data.peers.length; i++) {
        var otherSocketId = data.peers[i].id;
        var pc = getOrCreateRtcConnect(otherSocketId);
        const offer = await pc.createOffer(offerOptions);
        onCreateOfferSuccess(pc, otherSocketId, offer);
        // Solution
        // 
        // onCreateOfferSuccess => Cloure
        // (function(pc, otherSocketId){
        //     pc.createOffer(offerOptions).then(offer => onCreateOfferSuccess(pc, otherSocketId, offer), error => onCreateOfferError(pc, otherSocketId, error));
        // })(pc, otherSocketId);
        //
        // Promise 
        // pc.createOffer(offerOptions).then(offer => onCreateOfferSuccess(pc, otherSocketId, offer), error => onCreateOfferError(pc, otherSocketId, error));
    }
})

//joined [id,room]
socket.on('joined', function (data) {
    console.log('joined: ' + JSON.stringify(data));
    getOrCreateRtcConnect(data.from);
})

//offer [from,to,room,sdp]
socket.on('offer', function (data) {
    //console.log('offer: ' + JSON.stringify(data));
    var pc = getOrCreateRtcConnect(data.from);
    var rtcDescription = { type: 'offer', sdp: data.sdp };
    pc.setRemoteDescription(new RTCSessionDescription(rtcDescription));
    pc.createAnswer(offerOptions).then(offer => onCreateAnswerSuccess(pc, data.from, offer), error => onCreateAnswerError(pc, otherSocketId, error));
})

//answer [from,to,room,sdp]
socket.on('answer', function (data) {
    //console.log('answer: ' + JSON.stringify(data));
    var pc = getOrCreateRtcConnect(data.from);
    var rtcDescription = { type: 'answer', sdp: data.sdp };
    pc.setRemoteDescription(new RTCSessionDescription(rtcDescription));
})

//candidate  [from,to,room,candidate[sdpMid,sdpMLineIndex,sdp]]
socket.on('candidate', function (data) {
    //console.log('candidate: ' + JSON.stringify(data));
    var iceData = data.candidate;
    var pc = getOrCreateRtcConnect(data.from);
    var rtcIceCandidate = new RTCIceCandidate({
        candidate: iceData.sdp,
        sdpMid: iceData.sdpMid,
        sdpMLineIndex: iceData.sdpMLineIndex
    });
    pc.addIceCandidate(rtcIceCandidate);
})

//exit [from,room]
socket.on('exit', function (data) {
    //console.log('exit: ' + JSON.stringify(data));
    var pc = rtcConnects[data.from];
    if (typeof (pc) == 'undefined') {
        return;
    } else {
        getOrCreateRtcConnect(data.from).close;
        delete rtcConnects[data.from];
        remoteVideo.srcObject = null;

    }
})

//啟動視訊頭
function startCamera() {
    if (localStream == null) {
        navigator.mediaDevices
            .getUserMedia({
                audio: true,
                video: true
            })
            .then(stream => gotStream(stream))
            .catch(e => alert('getUserMedia() error: ${e.name}'));
    }
}
startCamera();

/** UI **/
//創建並加入Room
function createAndJoinRoom() {
    socket.emit('createAndJoinRoom', { room: roomName })
}

webRtcJoin_Btn.click(() => {
    createAndJoinRoom();
    webRtcJoin_Btn.hide();
});
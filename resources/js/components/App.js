import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import MediaHandler from '../MediaHandler';
import Pusher from 'pusher-js';
import Peer from 'simple-peer';
import axios from 'axios';

const APP_KEY = '0a191ea00d5bf967aaa0';

export default class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            hasMedia: false,
            otherUserId: null,
            users: [],
            seconds: 0
        };

        this.user = window.user;
        this.user.stream = null;
        this.peers = {};

        this.mediaHandler = new MediaHandler();
        this.setupPusher();

        this.getUsersApi = this.getUsersApi.bind(this);
        this.callTo = this.callTo.bind(this);
        this.setupPusher = this.setupPusher.bind(this);
        this.startPeer = this.startPeer.bind(this);
    }

    componentWillMount() {
        this.mediaHandler.getPermissionsMyVideo()
            .then((stream) => {
                this.setState({hasMedia: true});
                this.user.stream = stream;

                try {
                    this.myVideo.srcObject = stream;
                } catch (e) {
                    this.myVideo.src = URL.createObjectURL(stream);
                }

                this.myVideo.play();
            });

        this.mediaHandler.getPermissions()
            .then((stream) => {
                this.setState({hasMedia: true});
                this.user.stream = stream;
            });

        this.getUsersApi();
    }

    getUsersApi() {
        axios.get('api/user').then(response => {
            this.setState({
                users: response.data
            });
        }).catch(errors => {
            console.log(errors);
        });
    }

    setupPusher() {
        this.pusher = new Pusher(APP_KEY, {
            authEndpoint: '/pusher/auth',
            cluster: 'eu',
            auth: {
                params: this.user.id,
                headers: {
                    'X-CSRF-Token': window.csrfToken
                }
            }

        });

        this.channel = this.pusher.subscribe('presence-video-channel');

        this.channel.bind(`client-signal-${this.user.id}`, (signal) => {
            let peer = this.peers[signal.userId];

            // if peer is not already exists, we got an incoming call
            if (peer === undefined) {
                this.setState({otherUserId: signal.userId});
                peer = this.startPeer(signal.userId, false);
            }

            peer.signal(signal.data);
        });
    }

    startPeer(userId, initiator = true) {
        const peer = new Peer({
            initiator,
            stream: this.user.stream,
            trickle: false
        });

        peer.on('signal', (data) => {
            this.channel.trigger(`client-signal-${userId}`, {
                type: 'signal',
                userId: this.user.id,
                data: data
            });
        });

        peer.on('stream', (stream) => {
            try {
                this.userVideo.srcObject = stream;
            } catch (e) {
                this.userVideo.src = URL.createObjectURL(stream);
            }

            this.userVideo.play();
        });

        peer.on('close', () => {
            let peer = this.peers[userId];

            if (peer !== undefined) {
                peer.destroy();
            }

            this.peers[userId] = undefined;
        });

        return peer;
    }

    callTo(userId) {
        this.peers[userId] = this.startPeer(userId);

        axios.put('api/user/' + this.user.id, {is_online: 0}).then(response => {
            console.log(response)
        }).catch(errors => {
            console.log(errors);
        });

        axios.put('api/user/' + userId, {is_online: 0}).then(response => {
            console.log(response)
        }).catch(errors => {
            console.log(errors);
        });
    }

    tick() {
        this.setState(prevState => ({
            seconds: prevState.seconds + 1
        }));
    }

    componentDidMount() {
        this.interval = setInterval(() => this.getUsersApi(), 10000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    render() {
        return (
            <div className="App">
                <div className="user-id">
                    <div>Your username: <b>{this.user.name}</b></div>
                </div>

                <div className="video-container">
                    <video className="my-video" ref={(ref) => {
                        this.myVideo = ref;
                    }}></video>
                    <video className="user-video" ref={(ref) => {
                        this.userVideo = ref;
                    }}></video>
                </div>

                <div className="buttons">{this.state.users.map(user => {
                    return this.user.id !== user.id && user.is_online === 1 ?
                        <button className="btn btn-info" key={user.id}
                                onClick={() => this.callTo(user.id)}>Call {user.name}</button> : null;
                })}
                </div>
            </div>
        );
    }
}

if (document.getElementById('app')) {
    ReactDOM.render(<App/>, document.getElementById('app'));
}

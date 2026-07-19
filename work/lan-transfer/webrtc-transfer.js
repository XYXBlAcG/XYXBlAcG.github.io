import { CHUNK_SIZE, PUBLIC_STUN_SERVERS, buildManifest } from './lan-transfer-core.mjs';

function waitForIceGathering(peer) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      peer.removeEventListener('icegatheringstatechange', done);
      clearTimeout(timer);
      resolve();
    };

    const done = () => {
      if (peer.iceGatheringState === 'complete') finish();
    };

    peer.addEventListener('icegatheringstatechange', done);
    timer = setTimeout(finish, 3000);
  });
}

function waitForBufferedAmount(channel) {
  if (!channel || channel.readyState !== 'open') {
    return Promise.reject(new Error('连接已断开，无法继续传输'));
  }
  if (channel.bufferedAmount < 8 * CHUNK_SIZE) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      channel.removeEventListener('bufferedamountlow', handleLow);
      channel.removeEventListener('close', handleClose);
      channel.removeEventListener('error', handleError);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const handleLow = () => finish();
    const handleClose = () => fail('连接已断开，无法继续传输');
    const handleError = () => fail('数据通道发生错误，无法继续传输');

    channel.bufferedAmountLowThreshold = 4 * CHUNK_SIZE;
    channel.addEventListener('bufferedamountlow', handleLow);
    channel.addEventListener('close', handleClose);
    channel.addEventListener('error', handleError);

    if (channel.readyState !== 'open') {
      handleClose();
    } else if (channel.bufferedAmount < 8 * CHUNK_SIZE) {
      finish();
    }
  });
}

function assertChannelOpen(channel) {
  if (!channel || channel.readyState !== 'open') {
    throw new Error('连接已断开，无法继续传输');
  }
}

export class LanTransferSession extends EventTarget {
  constructor({ nickname, usePublicStun = false } = {}) {
    super();
    this.nickname = nickname || '设备';
    this.peer = new RTCPeerConnection({
      iceServers: usePublicStun ? PUBLIC_STUN_SERVERS : [],
    });
    this.channel = null;
    this.files = [];
    this.manifest = null;
    this.received = new Map();
    this.currentReceive = null;
    this.totalReceivedBytes = 0;
    this.totalSentBytes = 0;

    this.peer.onconnectionstatechange = () => {
      this.emit('connection', { state: this.peer.connectionState });
    };
    this.peer.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  attachChannel(channel) {
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => this.emit('channel-open', {});
    channel.onclose = () => this.emit('channel-close', {});
    channel.onerror = () => this.emit('error', { message: '数据通道发生错误' });
    channel.onmessage = (event) => this.handleMessage(event.data);
  }

  async createOffer(files) {
    this.files = Array.from(files || []);
    this.manifest = buildManifest(this.files);
    this.attachChannel(this.peer.createDataChannel('xyx-lan-transfer', { ordered: true }));
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    await waitForIceGathering(this.peer);
    return {
      version: 1,
      type: 'offer',
      nickname: this.nickname,
      manifest: this.manifest,
      sdp: this.peer.localDescription,
    };
  }

  async acceptOffer(signal) {
    await this.peer.setRemoteDescription(signal.sdp);
    this.manifest = signal.manifest;
    this.emit('manifest', { manifest: this.manifest, peerName: signal.nickname || '对方设备' });
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    await waitForIceGathering(this.peer);
    return {
      version: 1,
      type: 'answer',
      nickname: this.nickname,
      sdp: this.peer.localDescription,
    };
  }

  async acceptAnswer(signal) {
    await this.peer.setRemoteDescription(signal.sdp);
  }

  sendControl(message) {
    if (!this.channel || this.channel.readyState !== 'open') {
      throw new Error('连接尚未建立');
    }
    this.channel.send(JSON.stringify(message));
  }

  acceptTransfer() {
    if (!this.manifest) {
      throw new Error('尚未读取文件清单');
    }
    this.sendControl({ type: 'accept', transferId: this.manifest.transferId });
  }

  async sendFiles() {
    if (!this.manifest) {
      throw new Error('尚未创建文件清单');
    }
    this.totalSentBytes = 0;
    this.sendControl(this.manifest);

    for (let index = 0; index < this.files.length; index += 1) {
      const file = this.files[index];
      const info = this.manifest.files[index];
      this.sendControl({ type: 'file-start', fileId: info.id });

      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        assertChannelOpen(this.channel);
        await waitForBufferedAmount(this.channel);
        assertChannelOpen(this.channel);
        const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        assertChannelOpen(this.channel);
        this.channel.send(chunk);
        this.totalSentBytes += chunk.byteLength;
        this.emit('send-progress', {
          sentBytes: this.totalSentBytes,
          totalBytes: this.manifest.totalBytes,
        });
      }

      this.sendControl({ type: 'file-end', fileId: info.id });
    }

    this.sendControl({ type: 'transfer-complete', transferId: this.manifest.transferId });
  }

  handleMessage(data) {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        this.handleControl(message);
      } catch (error) {
        this.emit('error', { message: `控制消息无法解析：${error.message}` });
      }
      return;
    }

    if (!this.currentReceive) return;
    this.currentReceive.chunks.push(data);
    this.currentReceive.receivedBytes += data.byteLength;
    this.totalReceivedBytes += data.byteLength;
    this.emit('receive-progress', {
      receivedBytes: this.totalReceivedBytes,
      totalBytes: this.manifest.totalBytes,
    });
  }

  handleControl(message) {
    if (message.type === 'manifest') {
      this.manifest = message;
      this.totalReceivedBytes = 0;
      this.received.clear();
      this.emit('manifest', { manifest: message });
    }

    if (message.type === 'accept') {
      this.emit('accepted', {});
    }

    if (message.type === 'file-start') {
      const info = this.manifest?.files.find((file) => file.id === message.fileId);
      if (!info) {
        this.emit('error', { message: '收到未知文件片段' });
        return;
      }
      this.currentReceive = { info, chunks: [], receivedBytes: 0 };
    }

    if (message.type === 'file-end') {
      if (!this.currentReceive) {
        this.emit('error', { message: '收到文件结束标记，但没有正在接收的文件' });
        return;
      }

      if (message.fileId !== this.currentReceive.info.id) {
        this.emit('error', { message: '文件结束标记与当前文件不匹配，已丢弃该文件' });
        this.currentReceive = null;
        return;
      }

      if (this.currentReceive.receivedBytes !== this.currentReceive.info.size) {
        this.emit('error', { message: `文件“${this.currentReceive.info.name}”接收不完整，请重新传输` });
        this.currentReceive = null;
        return;
      }

      const blob = new Blob(this.currentReceive.chunks, { type: this.currentReceive.info.type });
      const file = { ...this.currentReceive.info, blob };
      this.received.set(this.currentReceive.info.id, file);
      this.emit('file-received', { file });
      this.currentReceive = null;
    }

    if (message.type === 'transfer-complete') {
      if (!this.manifest) {
        this.emit('error', { message: '尚未收到文件清单，无法完成传输' });
        return;
      }

      const allFilesReceived = this.manifest.files.every((file) => this.received.has(file.id));
      if (!allFilesReceived || this.received.size !== this.manifest.files.length) {
        this.emit('error', {
          message: `传输未完成：应收到 ${this.manifest.files.length} 个文件，实际收到 ${this.received.size} 个`,
        });
        return;
      }

      this.emit('transfer-complete', { files: Array.from(this.received.values()) });
    }
  }

  close() {
    if (this.channel) this.channel.close();
    this.peer.close();
  }
}
